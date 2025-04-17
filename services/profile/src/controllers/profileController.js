const profileService = require('../services/profileService');

exports.getProfile = async (req, res) => {
  const { id } = req.params;
  const result = await profileService.getProfileById(id);
  res.status(result.status).json(result);
};

exports.updateProfile = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const result = await profileService.updateProfileById(id, data);
  res.status(result.status).json(result);
};
