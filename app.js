require('./config/config');

const http = require('http');
const reload = require('reload');
const express = require('express');
const pjax    = require('express-pjax');
const session = require('express-session');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const _ = require('lodash');
const axios = require('axios');

const {serverRunning} = require('./js/serverRunning');
const {sheet} = require('./server/sheets.js');
const {Users} = require('./models/users');
const {SheetData} = require('./models/users');
const {sendmail} = require('./js/sendmail');
const {Subscription} = require('./models/subscription');


var app = express();
var port = process.env.PORT || 3000;
app.use(pjax());
app.use(express.static(__dirname+'/static'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(session({
  secret: 'oasdfkljh2j3lgh123ljkhl12kjh3',
  resave: false,
  saveUninitialized: true,
}))
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine','hbs');

hbs.registerHelper("inc", function(value, options) {
    return parseInt(value) + 1;
});

let authenticate = (req,res,next) => {
  let token = req.params.token || req.body.token || req.query.token;
  Users.findByToken(token).then((user) => {
    if (!user) return Promise.reject('No user found for token :', token);
    req.params.user = user;
    next();
  }).catch((e) => {
    console.log(e);
    req.url = '/';
    return app._router.handle(req, res, next);
  });
};

let convertGoogleData = function(data) {
  let part = '', poppedItem = '', nobject = {};
  let en = data;
  _.each(en,(v,i) => {
    if (!v[0] || i == 0) {
      part = en[i+1][0].replace(/ /g,'');
      nobject[part] = {};
      return;
    }
    poppedItem = v.shift().replace(/ /g,'');
    if (!v[0]) return;
    nobject[part][poppedItem] = v;
  })
  return nobject;
}

app.get('/publish',(req,res) => {
  sheet('naturaltherapy','read').then(msg => {
      let data = convertGoogleData(msg[0].values);
      console.log(JSON.stringify(data, 0, 2));
      // console.log(data.LandingPage.Logo[0]);
      res.status(200).render('home.hbs',data);
  }).catch(e => console.log(e));
})

app.get('/',(req,res) => {
  res.render('home.hbs');
})

app.get('/login',(req,res) => {
  res.status(200).render('login.hbs');
})

app.get('/signup_request',(req,res) => {
  console.log('signup request');
  let user = new Users({
    email: 'sajidaparveen@gmail.com',
    password: '12341234'
  });
  user.save()
  .then(msg => res.status(200).send(msg))
  .catch(e => {
    console.log(e);
    res.status(404).send(e);
  });
})

app.post('/login_request',(req,res) => {
  console.log('request made');
  var user = _.pick(req.body,['password']);
  user.email = "sajidaparveen@gmail.com";
  // console.log(user);
  Users.findByCredentials(user.email, user.password).then((returned) => {
    console.log('returned');
    if (!returned) return Promise.reject('Wrong password !')
    return returned.generateAuthToken(req);
  }).then((user) => {
    if (!user) return Promise.reject('Failed to generate token ! Kindly contact the developer !');
    console.log('token found !');
    return res.status(200).send(user.tokens[0].token);
  }).catch((e) => {
    console.log(e);
    res.status(404).send(e);
  });
})

app.get('/admin',(req,res) => {
  res.render('admin.hbs',{
    google_link: process.env.google_link,
    token: 'asdfas'
  });
})

app.get('/fetch_google_sheet',(req,res) => {
  return res.status(200).send('done');
  sheet('naturaltherapy','read').then(msg => {
      let data = convertGoogleData(msg[0].values);
      let sheetData = new SheetData ({
        en: convertGoogleData(msg[0].values),
        ur: convertGoogleData(msg[1].values),
        nok: convertGoogleData(msg[2].values)
      });
      return sheetData.save();
    }).then(returned => {
      res.status(200).send('done');
    })
  }).catch(e => {
    console.log(e);
    res.status(400).send(e);
  });
})

app.get('/draft_site',(req,res) => {
  // TODO: fetch id of draft data and render that on home page
  let returned = {
    LandingPage: {
      Logo: ['I am a draft website'],
    }
  }
  res.status(200).render('home.hbs',returned);
})

app.post('/deploy_request', (req,res) => {
  // TODO: find by req.body.id > switch published status to true > convert old published to false
  res.status(200).send('published');
})

serverRunning();

module.exports = {app, http};
