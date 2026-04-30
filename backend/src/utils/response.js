export const success = (res, data, message = 'OK', statusCode = 200, meta) => {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const created = (res, data, message = 'Created') =>
  success(res, data, message, 201);

export const noContent = (res) => res.status(204).send();
