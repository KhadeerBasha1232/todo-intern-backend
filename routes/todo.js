const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const schedule = require('node-schedule');
const moment = require('moment-timezone');
const JWT_SECRET = 'khadeerisaboy';
const Todo = require("../models/Todo")
require('dotenv').config()
// Your email configuration
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });


  router.post('/todos', [
    body('title').notEmpty().withMessage('Title cannot be empty'),
    body('description').notEmpty().withMessage('Description cannot be empty'),
    body('date').isISO8601().withMessage('Invalid date format'),
    body('time').custom(value => {
      if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        throw new Error('Invalid time format');
      }
      return true;
    }),
    body('priority').isInt().withMessage('Priority must be an integer'),
  ], async (req, res) => {
    try {
        
      const { title, description, priority, date, time } = req.body;
      const status = false;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
  
      const token = req.header('auth-token');
      const decodedToken = jwt.verify(token, JWT_SECRET);
  
      const userId = decodedToken.user.id;
      const userEmail = decodedToken.user.email;
  
      const combinedDateTime = new Date(`${date}T${time}:00`);
      
      // Create new todo instance
      const newTodo = new Todo({
        title,
        description,
        status,
        priority,
        user_email: userEmail,
        user_id: userId,
        due_datetime: combinedDateTime
      });
  
      // Save todo to database
      await newTodo.save();
  
      // Schedule the email sending based on priority
      switch (priority) {
        case 2: // High priority
          scheduleHighPriorityEmail(title, description, combinedDateTime, userEmail);
          break;
        case 1: // Mid priority
          scheduleMidPriorityEmail(title, description, combinedDateTime, userEmail);
          break;
        case 0: // Low priority
          scheduleLowPriorityEmail(title, description, combinedDateTime, userEmail);
          break;
        default:
          scheduleEmail(title, description, combinedDateTime, userEmail);
          break;
      }
  
      res.json({ success: true, message: 'Todo stored successfully', todoId: newTodo._id });
    } catch (error) {
      console.error(error.message);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  });


  // Route to fetch all todos
router.get('/todos', async (req, res) => {
    try {
        

      const token = req.header('auth-token');
      const decodedToken = jwt.verify(token, JWT_SECRET);
  
      const userId = decodedToken.user.id;
      const page = parseInt(req.query.page) || 1; // Get page number from the query parameter, default to 1
      const todosPerPage = parseInt(req.query.todosPerPage) || 10; // Set the number of todos per page
  
      // Calculate the skip value based on the page number and number of todos per page
      const skip = (page - 1) * todosPerPage;
  
      // Query to get a specific range of todos for the given user, ordered by created_at in descending order
      const todos = await Todo.find({ user_id: userId })
                                .sort({ created_at: -1 })
                                .skip(skip)
                                .limit(todosPerPage);
  
      // Query to get the total number of todos for the given user
      const totalTodos = await Todo.countDocuments({ user_id: userId });
      const totalPages = Math.ceil(totalTodos / todosPerPage);
  
      res.json({
        success: true,
        todos,
        currentPage: page,
        totalPages: totalPages,
      });
    } catch (error) {
      console.error(error.message);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  });

  


  // Route to fetch a todo by ID
router.get('/todos/:todoId', async (req, res) => {
    try {
      const todoId = req.params.todoId;
      

      // Use Mongoose's findById method to find the todo by its ID
      const todo = await Todo.findById(todoId);
  
      // Check if todo is found
      if (!todo) {
        return res.status(404).json({ success: false, message: 'Todo not found' });
      }
  
      res.json({ success: true, todo });
    } catch (error) {
      console.error(error.message);
      return res.status(500).send('Internal server error');
    }
  });

  


  // Route to delete a todo
router.delete('/todos/:todoId', async (req, res) => {
    try {
      const todoId = req.params.todoId;
      

      const token = req.header('auth-token');
      const decodedToken = jwt.verify(token, JWT_SECRET);
  
      const userId = decodedToken.user.id;
  
      // Use Mongoose's findOneAndDelete method to find and delete the todo by its ID and user ID
      const deletedTodo = await Todo.findOneAndDelete({ _id: todoId, user_id: userId });
  
      // Check if todo is found and deleted
      if (!deletedTodo) {
        return res.status(404).json({ success: false, message: 'Todo not found or unauthorized' });
      }
  
      res.json({ success: true, message: 'Todo deleted successfully' });
    } catch (error) {
      console.error(error.message);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  });

  

  router.put('/todos/:todoId', [
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().notEmpty().withMessage('Description cannot be empty'),
    body('date').optional().isISO8601().withMessage('Invalid date format'),
    body('time').custom(value => {
      if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        throw new Error('Invalid time format');
      }
      return true;
    }),
  ], async (req, res) => {
    try {
      const todoId = req.params.todoId;
      

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
  
      const { title, description, priority, date, time } = req.body;
  
      const token = req.header('auth-token');
      const decodedToken = jwt.verify(token, JWT_SECRET);
  
      const userId = decodedToken.user.id;
  
      // Use Mongoose's findOneAndUpdate method to find and update the todo by its ID and user ID
      const updatedTodo = await Todo.findOneAndUpdate(
        { _id: todoId, user_id: userId },
        { $set: { title, description, priority, updated_at: Date.now(), due_datetime: date && time ? new Date(`${date}T${time}`) : null } },
        { new: true }
      );
  
      // Check if todo is found and updated
      if (!updatedTodo) {
        return res.status(404).json({ success: false, message: 'Todo not found or unauthorized' });
      }
  
      res.json({ success: true, message: 'Todo updated successfully' });
    } catch (error) {
      console.error(error.message);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  });



  // Route to fetch all high-priority todos
router.get('/hightodo', async (req, res) => {
    try {
      const token = req.header('auth-token');
      const decodedToken = jwt.verify(token, JWT_SECRET);
  
      const userId = decodedToken.user.id;
      

      // Use Mongoose's find method to get all high-priority todos for the given user
      const highPriorityTodos = await Todo.find({ user_id: userId, priority: 2 });
  
      res.json({
        success: true,
        highPriorityTodos,
      });
    } catch (error) {
      console.error(error.message);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  });

  

  // Route to fetch all mid-priority todos
router.get('/midtodo', async (req, res) => {
    try {
      const token = req.header('auth-token');
      const decodedToken = jwt.verify(token, JWT_SECRET);
  
      const userId = decodedToken.user.id;
      

      // Use Mongoose's find method to get all mid-priority todos for the given user
      const midPriorityTodos = await Todo.find({ user_id: userId, priority: 1 });
  
      res.json({
        success: true,
        midPriorityTodos,
      });
    } catch (error) {
      console.error(error.message);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  });
  
  
  // Route to fetch all low-priority todos
  router.get('/lowtodo', async (req, res) => {
    try {
      const token = req.header('auth-token');
      const decodedToken = jwt.verify(token, JWT_SECRET);
  
      const userId = decodedToken.user.id;
      

      // Use Mongoose's find method to get all low-priority todos for the given user
      const lowPriorityTodos = await Todo.find({ user_id: userId, priority: 0 });
  
      res.json({
        success: true,
        lowPriorityTodos,
      });
    } catch (error) {
      console.error(error.message);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  });

  

  // Method to schedule email sending
  function scheduleEmail(title, description, scheduledDateTime, recipientEmail) {
    try {
      console.log('Scheduling email for:', scheduledDateTime);
  
      // Parse the scheduledDateTime string and convert it to a Date object with the 'Asia/Kolkata' time zone
      const scheduledDate = moment.tz(scheduledDateTime, 'YYYY-MM-DDTHH:mm', 'Asia/Kolkata').toDate();
  
      // Schedule the job using node-schedule
      const job = schedule.scheduleJob(scheduledDate, () => {
        console.log('Executing scheduled job for:', scheduledDate);
  
        const mailOptions = {
          from: process.env.EMAIL,
          to: recipientEmail,
          subject: `Reminder: ${title}`,
          text: `Description: ${description}\nScheduled Time: ${scheduledDate}`,
        };
  
        emailTransporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
          } else {
            console.log('Email sent:', info.response);
          }
        });
      });
  
      console.log('Email scheduled successfully.');
    } catch (error) {
      console.error('Error scheduling email:', error);
    }
  }
  


  // Method to schedule email sending for high priority todos
function scheduleHighPriorityEmail(title, description, scheduledDateTime, recipientEmail) {
  try {
    const scheduledDate = moment.tz(scheduledDateTime, 'YYYY-MM-DDTHH:mm', 'Asia/Kolkata').toDate();

    // Send emails at different intervals before the scheduled time for high priority todos
    scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, 15);
    scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, 10);
    scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, 5);
    scheduleExactTimeEmail(title, description, scheduledDate, recipientEmail);

    console.log('High priority email scheduled successfully.');
  } catch (error) {
    console.error('Error scheduling high priority email:', error);
  }
}

// Method to schedule email sending for mid priority todos
function scheduleMidPriorityEmail(title, description, scheduledDateTime, recipientEmail) {
  try {
    const scheduledDate = moment.tz(scheduledDateTime, 'YYYY-MM-DDTHH:mm', 'Asia/Kolkata').toDate();

    // Send emails at different intervals before the scheduled time for mid priority todos
    scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, 10);
    scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, 5);
    scheduleExactTimeEmail(title, description, scheduledDate, recipientEmail);

    console.log('Mid priority email scheduled successfully.');
  } catch (error) {
    console.error('Error scheduling mid priority email:', error);
  }
}

// Method to schedule email sending for low priority todos
function scheduleLowPriorityEmail(title, description, scheduledDateTime, recipientEmail) {
  try {
    const scheduledDate = moment.tz(scheduledDateTime, 'YYYY-MM-DDTHH:mm', 'Asia/Kolkata').toDate();

    // Send emails at different intervals before the scheduled time for low priority todos
    scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, 5);
    scheduleExactTimeEmail(title, description, scheduledDate, recipientEmail);

    console.log('Low priority email scheduled successfully.');
  } catch (error) {
    console.error('Error scheduling low priority email:', error);
  }
}

// Method to schedule email at a specific interval before the scheduled time
function scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, minutesBefore) {
  const intervalDate = moment(scheduledDate).subtract(minutesBefore, 'minutes').toDate();

  const job = schedule.scheduleJob(intervalDate, () => {
    sendEmail(title, description, intervalDate, recipientEmail);
  });
}

// Method to schedule email at the exact scheduled time
function scheduleExactTimeEmail(title, description, scheduledDate, recipientEmail) {
  const job = schedule.scheduleJob(scheduledDate, () => {
    sendEmail(title, description, scheduledDate, recipientEmail);
  });
}

// Method to send an email
function sendEmail(title, description, scheduledDate, recipientEmail) {
  const mailOptions = {
    from: process.env.EMAIL,
    to: recipientEmail,
    subject: `Reminder: ${title}`,
    text: `Description: ${description}\nScheduled Time: ${scheduledDate}`,
  };

  emailTransporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

// Modify the existing scheduleEmail function to handle common functionality
function scheduleEmail(title, description, scheduledDateTime, recipientEmail) {
  try {
    const scheduledDate = moment.tz(scheduledDateTime, 'YYYY-MM-DDTHH:mm', 'Asia/Kolkata').toDate();

    // Send emails at different intervals before the scheduled time for all priority levels
    scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, 15);
    scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, 10);
    scheduleEmailAtInterval(title, description, scheduledDate, recipientEmail, 5);
    scheduleExactTimeEmail(title, description, scheduledDate, recipientEmail);

    console.log('Email scheduled successfully.');
  } catch (error) {
    console.error('Error scheduling email:', error);
  }
}




const checkPastDueTodos = async () => {
    try {
      const currentDate = new Date();
      

      // Find and update todos with due_datetime in the past and status not yet completed (status = false)
      const pastDueTodos = await Todo.updateMany({
        due_datetime: { $lt: currentDate },
        status: false
      }, {
        status: true
      });
      
      console.log('Checked and updated status of overdue todos successfully.');
    } catch (error) {
      console.error('Error checking and updating status of overdue todos:', error.message);
    }
  };
  
  const schedulePastDueTodosJob = () => {
    schedule.scheduleJob('*/1 * * * *', async () => {
      await checkPastDueTodos();
      console.log("checked");
    });
  };


  // Call the function to schedule the job
schedulePastDueTodosJob();


module.exports = router