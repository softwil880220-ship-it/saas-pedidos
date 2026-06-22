export function queryConNegocio(query, negocioId) {
  if (!negocioId) return query;
  return query.eq('negocio_id', negocioId);
}

export function payloadConNegocio(payload, negocioId) {
  if (!negocioId) return payload;
  return { ...payload, negocio_id: negocioId };
}

export function perteneceANegocio(item, negocioId) {
  if (!negocioId) return true;
  return item?.negocio_id === negocioId;
}
