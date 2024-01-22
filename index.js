const express = require('express');
const app = express();
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');

//creating the connection with the database.
mongoose.connect('mongodb+srv://ashrafu:ashrafu98@cluster0.wshnwjm.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });

//storing the uploaded files in the uploads file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
// set the uploads in the storage 
const upload = multer({storage});

// Defining the book schema
const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  price: Number,
  filename: String,
  path: String
});
//this is the book model
const Book = mongoose.model('Book', bookSchema);

//to strore the session on the database
const store = new MongoDBStore({
  uri: 'mongodb+srv://ashrafu:ashrafu98@cluster0.wshnwjm.mongodb.net/?retryWrites=true&w=majority',
  collection: 'sessions',
});

app.use(
  session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    store: store,
  })
);

//my middlewares
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));


//my variables
let user = [];
let comments = [];
//let confirmedUser = {};

//i am reading all the users that was signed in from the json file and put them in a variable user.
fs.readFile(path.join(__dirname, 'public', 'signups.json'), (err, data) => {
  if (err) throw err;
  user = JSON.parse(data);
});

//i am reading all the comments from the json file and then put them in a variable comments.
fs.readFile(path.join(__dirname, 'public', 'comments.json'), (err, data) => {
  if (err) throw err;
  comments = JSON.parse(data);
});

//This is the first route where it will require user to login or to signup in the forum.
app.get('^/$|/login(.html)?', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

//This route display all the comments in the home page.
app.get('/comments', (req, res) => {
  fs.readFile(path.join(__dirname, 'public', 'comments.json'),'utf8', (err, data) => {
    if (err) throw err;
    data = JSON.parse(data).reverse();
    res.json(data);
  })
});

// here we created the fuction to harsh the password 
async function hashPassword(password) {
  try {
    const hashPassword = await bcrypt.hash(password, 10);
    return hashPassword;
  } catch (error) {
    console.log('Error while hashing the password: ' + error);
    throw error;
  }
}

// This route is for signing the user (sign up).
app.post('/signup.html', async (req, res) => {
  const newUser = req.body.data;

  try {
    const hashedPassword = await hashPassword(newUser.password);
    newUser.password = hashedPassword;
    console.log('The hashed password is:', hashedPassword);

    const existID = user.find((id) => id.id === newUser.id);
    const existEmail = user.find((email) => email.email === newUser.email);

    if (existID) {
      res.json({ 
        status: 'id',
        message: 'The id you entered already exists. Try a new one' });
    } else if (existEmail) {
      res.json({ 
        status: 'email',
        message: 'The email you entered already exists, try a new one' });
    } else {
      user.push(newUser);
      fs.writeFile(
        path.join(__dirname, 'public', 'signups.json'),
        JSON.stringify(user, null, 4),
        (err) => {
          if (err) {
            console.error(err);
          }
        }
      );
      res.status(200).json({ 
        status: 'ok',
        message: 'Your information was saved successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error hashing the password' });
  }
});

// This route is for the login page.
app.post('/login.html', (req, res) => {
  const loginUser = req.body.data;
  console.log(loginUser);

  const existingUser = user.find((user) => user.id === loginUser.id);

  if (!existingUser) {
    res.json({ message: 'The ID you entered is not in our database. Please register.' });
    return;
  }

  bcrypt.compare(loginUser.password, existingUser.password, (err, result) => {
    if (result) {

      req.session.user = existingUser.id;



      res.json({ 
        status: 'ok',
        message: `Welcome back ${existingUser.id}` });
    } else {
      res.json({ 
        status: 'error',
        message: 'Wrong password, please try again' });
    }
  });
});

//This route is for posting a comment.
app.post('/home.html', (req, res) => {
  const comment = req.body.data;

  const commentObj = {
    name : req.session.user,
    comment : comment
  }

  console.log(commentObj);

  comments.push(commentObj);

  fs.writeFile(
    path.join(__dirname, 'public', 'comments.json'),
    JSON.stringify(comments, null, 4),
    (err) => {
      if (err) {
        console.error(err);
      }
    }
  );
  res.json({
    data: commentObj,
    message: "comment posted"});

});

//This is the route to send the user who was login(also in the session to the frontend)
app.get('/session-user', (req, res) => {
  const name = req.session.user;
  res.json(name);
});

// This is the request for the search to see if user ever posted anything on the platform.
app.post('/search', (req, res) => {
  const searchItem = req.body.data;
  console.log(searchItem);

  const matchingComments = comments.filter((user) => user.name === searchItem);
  console.log(matchingComments);

  if (matchingComments.length > 0) {
    res.json({
      status: 'okay',
      data: matchingComments
    });
  } else {
    res.json({
      status: 'error',
      data: 'The user never posted'
    });
  }
});


// This is the request the search in the library, where i use google api to send request to them 
app.post('/library', async(req, res) => {
  try{
    const book = req.body.data
    console.log(book);
    const key = 'AIzaSyBj9L0Pji-HzO5n-zy-y0xfX2r177fGgq8';

    const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${book}:keyes&key=${key}`);
    const books = response.data;
    res.json(books);
  }
  catch(error){
    console.log(error);
  }
})

//this route save the book information that user whats to sell.
app.post('/books', upload.single('bookFile'), async (req, res) => {
  try {
    const formData = req.file;
    const {title, author, price}= req.body;
    console.log(title, author, price);
    console.log(formData);
    
    const filename = formData.filename;
    const path = formData.path;


    console.log(path, filename);
    const newBook = new Book({ title, author, price, filename, path });
    const savedBook = await newBook.save();
    res.status(201).json(savedBook);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//get all the comment for a spcific user from the json file
app.get('/get-comment', (req, res) => {
  const userComments = comments.filter((user) => user.name === req.session.user);

  res.json(userComments);
});


// Get all books from the database
app.get('/books', async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


//This request checks if the url does not exists it will bring error
app.get('/*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(5001, () => console.log('The server is running on port: 5001'));