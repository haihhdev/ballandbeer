const Comment = require('../models/commentModel');

// Get all comments for a product
exports.getProductComments = async (req, res) => {
  try {
    const { productId } = req.params;
    const comments = await Comment.find({ productId })
      .populate('userId', 'avatar fullname username')
      .sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new comment
exports.createComment = async (req, res) => {
  try {
    const { productId } = req.params;
    const { content, rating, image } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!content || !rating) {
      return res.status(400).json({ message: 'Content and rating are required' });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Create comment object
    const commentData = {
      productId,
      userId,
      content,
      rating,
      hearts: 0,
      heartedBy: []
    };

    // Add image if provided
    if (image) {
      commentData.image = image;
    }

    const comment = await Comment.create(commentData);
    
    // Populate user data before sending response
    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'avatar fullname username');

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    console.error('Request body:', req.body);
    res.status(500).json({ 
      message: 'Error creating comment',
      error: error.message 
    });
  }
};

// Toggle heart on a comment
exports.toggleHeart = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user has already hearted this comment
    const hasHearted = comment.heartedBy?.includes(req.user.id);
    
    if (hasHearted) {
      comment.hearts -= 1;
      comment.heartedBy = comment.heartedBy.filter(id => id.toString() !== req.user.id.toString());
    } else {
      comment.hearts += 1;
      if (!comment.heartedBy) comment.heartedBy = [];
      comment.heartedBy.push(req.user.id);
    }

    await comment.save();
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a comment
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment owner or admin
    if (comment.userId.toString() !== req.user.id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await comment.deleteOne();
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Edit a comment
exports.editComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content, rating } = req.body;
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment owner or admin
    if (comment.userId.toString() !== req.user.id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    // Update comment
    comment.content = content;
    comment.rating = rating;
    comment.isEdited = true; // Add flag to indicate comment was edited

    await comment.save();
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 