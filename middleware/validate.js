import Joi from 'joi';

// returns express middleware that validates req[source] with provided Joi schema
export function validateSchema(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true, convert: true });
    if (error) {
      return res.status(400).json({ error: 'Validation failed', details: error.details.map(d => d.message) });
    }
    // replace the source with the validated/cleaned value
    req[source] = value;
    next();
  };
}

export default validateSchema;
