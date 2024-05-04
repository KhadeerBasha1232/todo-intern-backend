const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer")
const JWT_SECRET = 'khadeerisaboy';
const User = require('../models/User'); 
require('dotenv').config()

router.post('/createuser', [
    body('email', 'Enter a valid Email').isEmail(),
    body('name', 'Enter a Valid Name').isLength({ min: 3 }),
    body('password', 'Enter a Password more than 5 digits').isLength({ min: 5 }),
  ], async (req, res) => {
    
    let success = false;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success, errors: errors.array() });
    }
  
    const { name, email, password } = req.body;
  
    try {
      // Check if user with email already exists
      const existingUser = await User.findOne({ email });
      
      if (existingUser) {
        return res.status(400).json({ success, error: 'User with email already exists' });
      }
  
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
  
      // Create new user
      const newUser = new User({
        name,
        email,
        password: hashedPassword
      });
  
      // Save the user to the database
      await newUser.save();
  
      // Generate JWT token
      const data = {
        user: {
          id: newUser._id,
          email: newUser.email,
        },
      };
      const authtoken = jwt.sign(data, JWT_SECRET);
      success = true;
  
      res.json({
        email: newUser.email,
        name: newUser.name,
        success,
        authtoken,
      });
    } catch (error) {
      console.error('Error creating user:', error.message);
      return res.status(500).send('Internal server error');
    }
  });
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });


  router.post('/login', [
    body('email', 'Enter a valid Email').isEmail(),
    body('password', 'Password cannot be blank').exists(),
  ], async (req, res) => {
    try {
      console.log(req.body);
      
      let success = false;
      const errors = validationResult(req);
  
      if (!errors.isEmpty()) {
        return res.status(400).json({ success, errors: errors.array() });
      }
  
      const { email, password } = req.body;
  
      // Find user by email
      const user = await User.findOne({ email });
  
      if (!user) {
        return res.status(400).json({ success, message: 'Incorrect email or password' });
      }
  
      // Compare hashed password
      const passwordCompare = await bcrypt.compare(password, user.password);
  
      if (!passwordCompare) {
        return res.status(400).json({ success, message: 'Incorrect email or password' });
      }
  
      const data = {
        user: {
          id: user._id,
          email: user.email,
        },
      };
  
      const authtoken = jwt.sign(data, JWT_SECRET);
      success = true;
  
      return res.json({
        email: user.email,
        name: user.name,
        success,
        authtoken,
      });
    } catch (error) {
      console.error('Error in login:', error.message);
      return res.status(500).send('Internal server error');
    }
  });


  router.get('/getuser/:token', async (req, res) => {
    try {
        
      const token = req.params.token;
      const decodedToken = jwt.verify(token, JWT_SECRET);
      const userId = decodedToken.user.id;
      
      // Find user by ID
      const user = await User.findById(userId);
  
      if (!user) {
        console.log(`User with ID ${userId} not found`);
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      // Send the user in the response
      res.json({
        name: user.name,
        email: user.email
      });
    } catch (error) {
      console.error(error.message);
      return res.status(500).send('Internal server error');
    }
  });

  router.post('/forgotpassword', [
    body('email', 'Enter a valid Email').isEmail(),
  ], async (req, res) => {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
  
    const { email } = req.body;
  
    try {
      // Check if user with provided email exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      // Generate a reset token and set expiration time
      const resetToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
      // Update the user record with the reset token and expiration time
      user.resetToken = resetToken;
      user.resetTokenExpiresAt = resetTokenExpiresAt;
      await user.save();
      const CLIENT_BASE_URL = "https://todo-kb-intern.vercel.app/"
      // Send reset email to the user
      const resetLink = `${CLIENT_BASE_URL}/resetpassword/${resetToken}`;
      const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: 'Password Reset',
        html: `Click the following link to reset your password: <a href="${resetLink}">${resetLink}</a>`,
      };
  
      transporter.sendMail(mailOptions, (sendMailError) => {
        if (sendMailError) {
          console.error('Error sending reset email:', sendMailError.message);
          return res.status(500).send('Internal server error');
        }
  
        return res.json({ success: true, message: 'Password reset email sent successfully.' });
      });
    } catch (error) {
      console.error('Error processing forgot password request:', error.message);
      return res.status(500).send('Internal server error');
    }
  });


  router.post('/resetpassword/:token', [
    body('password', 'Password is required').exists(),
    body('confirmPassword', 'Confirm password is required').exists(),
  ], async (req, res) => {
    
    const resetToken = req.params.token;
    const { password, confirmPassword } = req.body;
  
    try {
      // Check if password and confirm password match
      if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match' });
      }
  
      // Verify the reset token
      const decodedToken = jwt.verify(resetToken, JWT_SECRET);
      console.log(decodedToken);
      const userId = decodedToken.userId;
  
      // Find user by ID
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      // Update user's password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      user.password = hashedPassword;
      await user.save();
  
      return res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      console.error('Error resetting password:', error.message);
      return res.status(500).send('Internal server error');
    }
  });
  


  module.exports = router;