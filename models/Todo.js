const mongoose = require('mongoose');
const autoIncrement = require('mongoose-auto-increment');

// Connect mongoose-auto-increment with your Mongoose instance
autoIncrement.initialize(mongoose.connection);

const todoSchema = new mongoose.Schema({
  id: {
    type: Number,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  user_email: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming there is a User model defined
    required: true
  },
  status: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 0
  },
  due_datetime: {
    type: Date,
    required: true
  },
  updated_at: {
    type: Date,
    default: Date.now,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    required: true
  }
});

// Add auto-increment plugin to the schema
todoSchema.plugin(autoIncrement.plugin, {
    model: 'Todo',
    field: 'id',
    startAt: 1, // Start the counter at 1
    incrementBy: 1 // Increment by 1
});

const Todo = mongoose.model('Todo', todoSchema);

module.exports = Todo;
