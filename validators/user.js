import Joi from 'joi';

export const addUserSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  avatar_url: Joi.string().uri().optional(),
  dob: Joi.string().optional(),
  gender: Joi.string().valid('male','female','other').optional(),
  phone: Joi.string().optional()
});

export const updateUserProfileSchema = Joi.object({
  username: Joi.string().min(3).max(30).optional(),
  email: Joi.string().email().optional(),
  avatar_url: Joi.string().uri().optional(),
  dob: Joi.string().optional(),
  gender: Joi.string().valid('male','female','other').optional(),
  phone: Joi.string().optional()
});

export const updatePasswordSchema = Joi.object({
  old_password: Joi.string().min(6).required(),
  new_password: Joi.string().min(6).required()
});

export const checkInSchema = Joi.object({
  location_id: Joi.number().integer().required()
});

export const completeChallengeSchema = Joi.object({
  user_id: Joi.number().integer().required(),
  challenge_id: Joi.number().integer().required()
});

export const avatarSchema = Joi.object({
  avatar_url: Joi.string().uri().required()
});
