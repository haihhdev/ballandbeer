const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const auth = require('../middleware/authMiddleware');

// Get all comments for a product
router.get('/products/:productId/comments', commentController.getProductComments);

// Create a new comment (requires authentication)
router.post('/products/:productId/comments', auth, commentController.createComment);

// Toggle heart on a comment (requires authentication)
router.post('/comments/:commentId/heart', auth, commentController.toggleHeart);

// Delete a comment (requires authentication)
router.delete('/comments/:commentId', auth, commentController.deleteComment);

// Edit a comment (requires authentication)
router.put('/comments/:commentId', auth, commentController.editComment);

module.exports = router; 