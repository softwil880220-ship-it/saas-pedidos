export function asegurarIdEnCatalogoNegocio(id, catalogo, nombreRecurso = 'Recurso') {
  if (id == null || id === '') {
    throw new Error(`${nombreRecurso}: identificador vacío.`);
  }

  const clave = String(id);
  const permitido = (catalogo || []).some((item) => String(item?.id) === clave);

  if (!permitido) {
    throw new Error(`${nombreRecurso} no válido para este negocio.`);
  }
}

export function asegurarInsumosRecetaEnCatalogo(filas, catalogoInsumos) {
  (filas || []).forEach((fila) => {
    asegurarIdEnCatalogoNegocio(fila.insumo_id, catalogoInsumos, 'Insumo');
  });
}

export function asegurarJornadaCaptura(jornadaId, jornadaAbierta) {
  if (!jornadaId || !jornadaAbierta?.id) {
    throw new Error('No hay jornada abierta válida.');
  }

  if (String(jornadaId) !== String(jornadaAbierta.id)) {
    throw new Error('La jornada no corresponde al negocio actual.');
  }
}

export function asegurarEmpleadoEnCatalogo(empleadoId, empleados) {
  if (empleadoId == null || empleadoId === '') {
    throw new Error('Empleado requerido.');
  }

  asegurarIdEnCatalogoNegocio(empleadoId, empleados, 'Empleado');
}

export function asegurarProductosEnCatalogo(productoIds, productos) {
  const unicos = [
    ...new Set((productoIds || []).map((id) => String(id)).filter(Boolean)),
  ];

  unicos.forEach((id) => {
    asegurarIdEnCatalogoNegocio(id, productos, 'Producto');
  });
}
