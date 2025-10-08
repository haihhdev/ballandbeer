const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get all comments for a product
router.get('/products/:productId/comments', commentController.getProductComments);

// Create a new comment (requires authentication)
router.post('/products/:productId/comments', authenticateToken, commentController.createComment);

// Toggle heart on a comment (requires authentication)
router.post('/comments/:commentId/heart', authenticateToken, commentController.toggleHeart);

// Delete a comment (requires authentication)
router.delete('/comments/:commentId', authenticateToken, commentController.deleteComment);

// Edit a comment (requires authentication)
router.put('/comments/:commentId', authenticateToken, commentController.editComment);

module.exports = router; 