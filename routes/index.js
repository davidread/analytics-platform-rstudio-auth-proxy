var express = require('express');
var passport = require('passport');
var httpProxy = require('http-proxy');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn()
var router = express.Router();

var env = {
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
  AUTH0_CALLBACK_URL: process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000/callback',
  USER: process.env.USER,
}

var proxy = httpProxy.createProxyServer({
  target: {
    host: process.env.SHINY_HOST,
    port: process.env.SHINY_PORT
  },
  ws: true
});

proxy.on('error', function(e) {
  console.log('Error connecting');
  console.log(e);
});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  if(req.user){
    // make sure Github usernames are lowercased - username is used in k8s resource labels,
    // which only allow lowercase
    if(req.user.__json && req.user.__json.nickname){
      var nickname = req.user.__json.nickname.toLowerCase()
      if (nickname === env.USER) {
        proxyReq.setHeader('X-RStudio-Username', nickname)
      } else {
        // Not the owner of the machine - 403 FORBIDDEN
        res.sendStatus(403);
      }
    }
  }
});

/* Handle login */
router.get('/login',
  function(req, res){
    res.render('login', { env: env });
  }
);

/* Handle logout */
router.get('/logout', function(req, res){
  req.logout();
  res.redirect('/login');
});

/* Handle auth callback */
router.get('/callback',
  passport.authenticate('auth0', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect(req.session.returnTo || '/');
  }
);

/* Proxy RStudio login URL */
router.all('/auth-sign-in', function(req, res, next) {
  proxy.web(req, res);
});

router.all('/favicon.ico', function(req, res, next) {
  proxy.web(req, res);
});

/* Authenticate and proxy all other requests */
router.all(/.*/, ensureLoggedIn, function(req, res, next) {
  proxy.web(req, res);
});


module.exports = router;
