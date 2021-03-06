const { Router } = require('express');
const router = new Router();
const mongoose = require('mongoose');

const bcryptjs = require('bcryptjs');
const saltRounds = 10;

const passport = require('passport');

const User = require('../models/User.model');

const routeGuard = require('../configs/route-guard.config');

// ****************************************************************************************
// POST - validate and create user
// ****************************************************************************************
router.post('/signup', (req, res, next) => {
  console.log(req.body);
  const { firstName, lastName, email, password } = req.body;


  if (!firstName || !lastName || !email || !password) {
    res.status(401).json({
      message: 'All fields are mandatory. Please provide your username, email and password.'
    });
    return;
  }

  const regex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
  if (!regex.test(password)) {
    res.status(500).json({
      message:
        'Password needs to have at least 6 chars and must contain at least one number, one lowercase and one uppercase letter.'
    });
    return;
  }

  bcryptjs
    .genSalt(saltRounds)
    .then(salt => bcryptjs.hash(password, salt))
    .then(hashedPassword => {

      const userData = {
        firstName,
        lastName,
        email,
        passwordHash: hashedPassword
      }

      console.log({userData});

      return User
        .create(userData)
        .then(user => {
          req.login(user, err => {
            if (err) return res.status(500).json({ message: 'Something went wrong with login!' });
            user.passwordHash = undefined;
            req.session.user = user; // may need for persistent session work around
            res.status(200).json({ message: 'Login successful!', user });
          });
        })
        .catch(err => {
          if (err instanceof mongoose.Error.ValidationError) {
            res.status(500).json({ message: err.message });
          } else if (err.code === 11000) {
            res.status(500).json({
              message: 'Username and email need to be unique. Either username or email is already used.'
            });
          } else {
            next(err);
          }
        });
    })
    .catch(err => next(err));
});

// ****************************************************************************************
// POST - validate and login user
// ****************************************************************************************
router.post('/login', (req, res, next) => {
  console.log('logging in server side');
  passport.authenticate('local', (err, user, failureDetails) => {
    console.log({ err });
    if (err) {
      res.status(500).json({ message: 'Something went wrong with database query.' });
      return;
    }

    if (!user) {
      res.status(401).json(failureDetails);
      return;
    }

    req.login(user, err => {
      console.log('logging in');
      if (err) return res.status(500).json({ message: 'Something went wrong with login!' });
      user.passwordHash = undefined;
      req.session.user = user; // may need for persistent session work around
      res.status(200).json({ message: 'Login successful!', user });
    });
  })(req, res, next);
});

// ****************************************************************************************
// POST - logout user
// ****************************************************************************************
router.post('/logout', routeGuard, (req, res, next) => {
  req.logout();
  // req.session.destroy();
  res.status(200).json({ message: 'Logout successful!' });
});

// ****************************************************************************************
// GET - check if user is logged in
// ****************************************************************************************
router.get('/isLoggedIn', (req, res) => {
  // console.log({userSession: req.session.user})

  if (req.user) {
    User
    .findById(req.user._id)
    .populate('teams tasks')
    .then(currentUser => {
      console.log({currentUser});
      currentUser.passwordHash = undefined;
      res.status(200).json({user: currentUser});
      return;
    })
    .catch(err => next(err));
  } else {
    res.status(401).json({ message: 'Unauthorized access!' });
    return;
  }
});

// ****************************************************************************************
// GET - get all users
// ****************************************************************************************
router.get('/get-users', (req, res) => {
  User
  .find()
  .then(usersFromDB => {
    const userList = usersFromDB.map(user => {
      user.passwordHash = undefined;
      return user;
    });

    res.status(200).json({ users: userList });
  })
  .catch(err => next(err));
    
});

// ****************************************************************************************
// POST - update user info
// ****************************************************************************************
router.post('/update-user', (req, res) => {

  User
  .findByIdAndUpdate(req.user._id, req.body, {new: true})
  .then(usersFromDB => {
    res.status(200).json({ user: usersFromDB });
  })
  .catch(err => next(err));
    
});

module.exports = router;
