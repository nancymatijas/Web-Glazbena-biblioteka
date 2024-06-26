var express = require('express');
var router = express.Router();

router.use(express.static('public'));

router.get('/:id', function (req, res) {
  res.redirect('/tracks/' + req.params.id);
});

module.exports = router;
