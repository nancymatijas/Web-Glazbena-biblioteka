var express = require('express');
var router = express.Router();
const db = require('../db'); 
router.use(express.static('public')); 
const SpotifyWebApi = require('spotify-web-api-node');
const spotifyApi = new SpotifyWebApi({
    clientId: '025959746baa40cbb7a95ae639b57a47',
    clientSecret: 'bf2abfb50eb848de9c3b6014d556f4b7',
});

router.get('/', function (req, res) {
  var username = req.session.username;
  var isAdmin = req.session.isAdmin; 

  if (isAdmin) {
    req.session.destroy(function(err) {
      if (err) {
        console.log('Error occurred while logging out admin:', err);
        res.render('error'); 
        return;
      }
      res.redirect('/authentication/logout'); 
    });
    return; 
  }

  res.render('index', { loggedIn: req.session.loggedIn, username: username });
});

router.get('/api/albums', function (req, res) {
  spotifyApi.clientCredentialsGrant().then(
    (data) => {
      spotifyApi.setAccessToken(data.body['access_token']);

      spotifyApi.getNewReleases({ limit: 50, offset: 0, country: 'HR', include_groups: 'album,single' })
        .then((data) => {
          const albums = data.body.albums.items;

          const albumsWithImages = albums.map(album => {
            const imageUrl = album.images.length > 0 ? album.images[0].url : null;
            return {
              ...album,
              imageUrl: imageUrl
            };
          });

          res.json(albumsWithImages);
        })
        .catch((err) => {
          console.log('Error occurred while getting new releases:', err);
          res.status(500).json({ error: 'Error occurred while getting new releases' });
        });
    },
    (err) => {
      console.log('Error retrieving access token:', err);
      res.status(500).json({ error: 'Error retrieving access token' });
    }
  );
});



router.get('/tracks/:id', function (req, res) {
  const albumId = req.params.id;

  spotifyApi.getAlbum(albumId)
  .then((data) => {
    var username = req.session.username;
    const album = data.body;
    const imageUrl = album.images.length > 0 ? album.images[0].url : null;
    const albumTitle = album.name; 
    const albumArtist = album.artists[0].name;

    spotifyApi.getAlbumTracks(albumId, { limit: 50, offset: 0 })
      .then((data) => {
        const tracks = data.body.items;
        res.render('tracks', { tracks: tracks, albumImageUrl: imageUrl, albumTitle: albumTitle, albumArtist: albumArtist, loggedIn: req.session.loggedIn, username: username }); 
      })
      .catch((err) => {
        console.log('Error occurred while getting album tracks:', err);
        res.send("Error2");
      });
  })
  .catch((err) => {
    console.log('Error occurred while getting album details:', err);
    res.send("Error3");
  });

});


//---------------------------------------------------------------------------PLAYLISTA PJESAMA-------------------------------------------------------------------------------
router.get("/playlist_tracks", function (req, res) {
  if (req.session.loggedIn) {
    var username = req.session.username;
    res.render("playlist_tracks", { loggedIn: req.session.loggedIn, username: username });
  } else {
    res.redirect("/authentication/login");
  }
});

router.get('/api/playlist_tracks', function (req, res) {
  if (req.session.loggedIn) {
    const userId = req.session.user;
    db.query("SELECT * FROM playlist_tracks WHERE user_id = ?", userId, (error, result) => {
      if (error) {
        console.log('Error occurred while retrieving playlist tracks:', error);
        res.status(500).json({ error: 'Error occurred while retrieving playlist tracks' });
      } else {
        res.json(result);
      }
    });
  } else {
    res.status(401).json({ error: 'User not logged in' });
  }
});

router.get('/api/albums/:id/tracks', function (req, res) {
  const albumId = req.params.id;

  spotifyApi.getAlbum(albumId)
    .then((data) => {
      const album = data.body;
      const imageUrl = album.images.length > 0 ? album.images[0].url : null;
      const albumTitle = album.name;
      const albumArtist = album.artists[0].name;

      spotifyApi.getAlbumTracks(albumId, { limit: 50, offset: 0 })
        .then((data) => {
          const tracks = data.body.items;
          res.json({ tracks, albumImageUrl: imageUrl, albumTitle, albumArtist });
        })
        .catch((err) => {
          console.log('Error occurred while getting album tracks:', err);
          res.status(500).json({ error: 'Error occurred while getting album tracks' });
        });
    })
    .catch((err) => {
      console.log('Error occurred while getting album details:', err);
      res.status(500).json({ error: 'Error occurred while getting album details' });
    });
});


router.post("/playlist_tracks/add", function (req, res) {
  if (req.session.loggedIn) {
    const trackId = req.body.trackId;
    const userId = req.session.user;

    spotifyApi.getTrack(trackId)
      .then((data) => {
        const track = data.body;
        const artist = track.artists[0].name;
        const trackName = track.name;
        const albumName = track.album.name;
        const imageUrl = track.album.images.length > 0 ? track.album.images[0].url : null;

        db.query(
          "SELECT * FROM playlist_tracks WHERE track_id = ? AND user_id = ?",
          [trackId, userId],
          (error, result) => {
            if (error) {
              console.log('Error occurred while checking existing track:', error);
              return res.status(500).send("Error checking playlist.");
            }
            if (result.length > 0) {
              console.log("Song already exists in playlist.");
              return res.status(400).send("Song already exists in playlist.");
            } else {
              db.query(
                "INSERT INTO playlist_tracks (user_id, track_id, track_name, artist, album_name, cover_image_url) VALUES (?, ?, ?, ?, ?, ?)",
                [userId, trackId, trackName, artist, albumName, imageUrl],
                (error, result) => {
                  if (error) {
                    console.log('Error occurred while adding track to playlist:', error);
                    return res.status(500).send("Error adding song to playlist.");
                  }
                  console.log("Song successfully added to playlist.");
                  return res.status(200).send("Song successfully added to playlist.");
                }
              );
            }
          }
        );
      })
      .catch((err) => {
        console.log('Error occurred while getting track details:', err);
        return res.status(500).send("Error adding song to playlist.");
      });
  } else {
    return res.status(401).send("User not logged in.");
  }
});


router.post("/playlist_tracks/delete", function (req, res) {
  if (req.session.loggedIn) {
    const trackId = req.body.trackId;
    const userId = req.session.user;
    db.query("DELETE FROM playlist_tracks WHERE track_id = ? AND user_id = ?", [trackId, userId], (error, result) => {
      if (error) throw error;
      res.redirect("/playlist_tracks");
    });
  } else {
    res.redirect("/authentication/login");
  }
});



/*-------------------------------------------------------------------------SEARCH------------------------------------------------------------------------*/

router.get('/api/search', function (req, res) {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'No search query provided' });
  }

  spotifyApi.clientCredentialsGrant().then(
    (data) => {
      spotifyApi.setAccessToken(data.body['access_token']);

      spotifyApi.searchTracks(query, { limit: 12 })
        .then((data) => {
          const tracks = data.body.tracks.items;

          const tracksWithImages = tracks.map(track => {
            const imageUrl = track.album.images.length > 0 ? track.album.images[0].url : null;
            return {
              ...track,
              imageUrl: imageUrl
            };
          });

          res.json(tracksWithImages);
        })
        .catch((err) => {
          console.log('Error occurred while searching tracks:', err);
          res.status(500).json({ error: 'Error occurred while searching tracks' });
        });
    },
    (err) => {
      console.log('Error retrieving access token:', err);
      res.status(500).json({ error: 'Error retrieving access token' });
    }
  );
});

router.post("/playlist_tracks/add", function (req, res) {
  if (req.session.loggedIn) {
    const trackId = req.body.trackId;
    const userId = req.session.user;

    spotifyApi.getTrack(trackId)
      .then((data) => {
        const track = data.body;
        const artist = track.artists[0].name;
        const trackName = track.name;
        const albumName = track.album.name;
        const imageUrl = track.album.images.length > 0 ? track.album.images[0].url : null;

        db.query(
          "SELECT * FROM playlist_tracks WHERE track_id = ? AND user_id = ?",
          [trackId, userId],
          (error, result) => {
            if (error) {
              console.log('Error occurred while checking existing track:', error);
              return res.status(500).send("Error checking playlist.");
            }
            if (result.length > 0) {
              console.log("Song already exists in playlist.");
              return res.status(200).send("Song already exists in playlist.");
            } else {
              db.query(
                "INSERT INTO playlist_tracks (user_id, track_id, track_name, artist, album_name, cover_image_url) VALUES (?, ?, ?, ?, ?, ?)",
                [userId, trackId, trackName, artist, albumName, imageUrl],
                (error, result) => {
                  if (error) {
                    console.log('Error occurred while adding track to playlist:', error);
                    return res.status(500).send("Error adding song to playlist.");
                  }
                  console.log("Song successfully added to playlist.");
                  return res.status(200).send("Song successfully added to playlist.");
                }
              );
            }
          }
        );
      })
      .catch((err) => {
        console.log('Error occurred while getting track details:', err);
        return res.status(500).send("Error adding song to playlist.");
      });
  } else {
    return res.status(401).send("User not logged in.");
  }
});



module.exports = router;