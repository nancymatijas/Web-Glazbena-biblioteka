var express = require("express");
var router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const SpotifyWebApi = require('spotify-web-api-node');
const spotifyApi = new SpotifyWebApi({
  clientId: '025959746baa40cbb7a95ae639b57a47',
  clientSecret: 'bf2abfb50eb848de9c3b6014d556f4b7',
});


router.get('/login', function (req, res) {
    res.render('login_admin', {layout: 'layout_admin'});
});

router.post('/login', function (req, res) {
    var flag = false;
    db.query("SELECT * FROM admins", async (error, result) => {
        if (error) {
            throw error;
        }
        for (var i = 0; i < result.length; i++) {
            if (req.body.username == result[i].username && await bcrypt.compare(req.body.password, result[i].password)) {
                flag = true;
                req.admin = result[i].id;
                req.username = req.body.username;
                console.log(req.admin);
                break;
            }
        }
        if (flag) {
            req.session.isAdmin = true;
            req.session.loggedIn = true;
            req.session.admin = req.admin;
            req.session.username = req.username;
            console.log(req.admin);
            res.redirect('/admin/dashboard_admin');
        } else {
            res.send('<script>alert("Neispravno ime ili lozinka!"); window.location.href="/admin/login";</script>');
        }
    });
});


router.get("/logout", function (req, res) {
    req.session.loggedIn = false;
    req.session.destroy();
    console.log("Logout");
    res.redirect("/admin/login");
});


router.get('/dashboard_admin', async (req, res) => {
  if (req.session.isAdmin && req.session.loggedIn) {
    res.render("dashboard_admin", { 
      loggedIn: req.session.loggedIn,
      layout: 'layout_admin' 
    });
  } else {
    return res.redirect('/admin/login');
  }
});


router.get('/api/users', function (req, res) {
  if (!req.session.isAdmin || !req.session.loggedIn) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  db.query("SELECT * FROM users", (error, results) => {
      if (error) {
          return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json(results);
  });
});

router.get('/api/admins', function (req, res) {
  if (!req.session.isAdmin || !req.session.loggedIn) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  db.query("SELECT * FROM admins", (error, results) => {
      if (error) {
          return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json(results);
  });
});


router.post('/delete_user', function (req, res) {
    const userId = req.body.userId;
    db.query("DELETE FROM users WHERE id = ?", [userId], (error, result) => {
        if (error) throw error;
        console.log(`User with ID ${userId} deleted successfully`);
        res.redirect('/admin/dashboard_admin');
    });
});

router.get('/dashboard_admin/user/:userId', function (req, res) {
  if (!req.session.isAdmin || !req.session.loggedIn) {
      return res.redirect('/admin/login');
  }
  const userId = req.params.userId;
  db.query("SELECT * FROM users WHERE id = ?", [userId], (error, userResults) => {
      if (error) throw error;

      db.query("SELECT * FROM playlist_tracks WHERE user_id = ?", [userId], (error, trackResults) => {
          if (error) throw error;
              res.render("user_details", {
                  loggedIn: req.session.loggedIn,
                  username: req.session.username,
                  isAdmin: req.session.isAdmin,
                  user: userResults[0], 
                  tracks: trackResults, 
                  layout: 'layout_admin'
              });
      });
  });
});


router.get('/api/user/:userId/tracks', (req, res) => {
  const userId = req.params.userId;
  db.query("SELECT * FROM playlist_tracks WHERE user_id = ?", [userId], (error, tracks) => {
    if (error) {
      console.error('Error fetching user tracks:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json(tracks);
  });
});

router.post('/dashboard_admin/user/:userId/delete_track/:trackId', function (req, res) {
  const trackId = req.params.trackId;
  const userId = req.params.userId;

  db.query("DELETE FROM playlist_tracks WHERE id = ?", [trackId], (error, result) => {
      if (error) throw error;
      console.log(`Track with ID ${trackId} deleted successfully`);
      res.redirect('/admin/dashboard_admin/user/' + userId);
  });
});

module.exports = router;
