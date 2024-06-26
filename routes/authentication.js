var express = require('express');
var router = express.Router();
const db = require('../db');

router.use(express.static('public'));

router.get("/signup", function (req, res) {
    res.render("signup", { loggedIn: req.session.loggedIn });
});

router.get("/login", function (req, res) {
    res.render("login", { loggedIn: req.session.loggedIn });
});

router.get("/logout", function (req, res) {
    req.session.loggedIn = false;
    req.session.destroy();
    console.log("Logout");
    res.redirect("login");
});


module.exports = router;
