import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { payloadConNegocio, queryConNegocio } from './tenantHelpers';

const UNIDADES_MEDIDA_COMUNES = ['g', 'pieza', 'ml'];

function unidadMedidaParaFormulario(valor) {
  if (valor === 'kg') return 'g';
  if (valor === 'litro') return 'ml';
  return UNIDADES_MEDIDA_COMUNES.includes(valor) ? valor : 'g';
}

function formularioInsumoVacio() {
  return {
    nombre: '',
    unidad_medida: 'g',
  };
}

export default function PanelInsumos({ negocioId }) {
  const [insumos, setInsumos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [desactivandoId, setDesactivandoId] = useState(null);
  const [editandoInsumoId, setEditandoInsumoId] = useState(null);
  const [insumoForm, setInsumoForm] = useState(formularioInsumoVacio);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const cargarInsumos = useCallback(async () => {
    if (!negocioId) {
      setInsumos([]);
      setCargando(false);
      return;
    }

    setCargando(true);

    let query = supabase
      .from('insumos')
      .select('id, nombre, unidad_medida, activo, created_at')
      .order('nombre');

    query = queryConNegocio(query, negocioId);

    if (!mostrarInactivos) {
      query = query.eq('activo', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[insumos] error al cargar catálogo', error);
      setInsumos([]);
    } else {
      setInsumos(data || []);
    }

    setCargando(false);
  }, [negocioId, mostrarInactivos]);

  useEffect(() => {
    void cargarInsumos();
  }, [cargarInsumos]);

  const insumosOrdenados = useMemo(
    () =>
      [...insumos].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
      ),
    [insumos]
  );

  const resetInsumoForm = () => {
    setEditandoInsumoId(null);
    setInsumoForm(formularioInsumoVacio());
  };

  const handleInsumoFormChange = (event) => {
    const { name, value } = event.target;
    setInsumoForm((prev) => ({ ...prev, [name]: value }));
  };

  const iniciarEdicionInsumo = (insumo) => {
    setEditandoInsumoId(insumo.id);
    setInsumoForm({
      nombre: insumo.nombre || '',
      unidad_medida: unidadMedidaParaFormulario(insumo.unidad_medida),
    });
  };

  const handleInsumoSubmit = async (event) => {
    event.preventDefault();
    if (!negocioId) return;

    const nombre = insumoForm.nombre.trim();
    const unidad_medida = insumoForm.unidad_medida.trim();

    if (!nombre || !unidad_medida) return;

    setGuardando(true);

    const payload = { nombre, unidad_medida };

    try {
      if (editandoInsumoId) {
        const { data, error } = await queryConNegocio(
          supabase.from('insumos').update(payload).eq('id', editandoInsumoId),
          negocioId
        )
          .select()
          .single();

        if (error || !data) {
          if (error) console.error('[insumos] error al actualizar', error);
          return;
        }

        setInsumos((prev) => {
          const next = prev.map((insumo) =>
            String(insumo.id) === String(data.id) ? data : insumo
          );

          if (mostrarInactivos) {
            return next;
          }

          return data.activo === false
            ? next.filter((insumo) => String(insumo.id) !== String(data.id))
            : next;
        });
        resetInsumoForm();
        return;
      }

      const { data, error } = await supabase
        .from('insumos')
        .insert(payloadConNegocio({ ...payload, activo: true }, negocioId))
        .select()
        .single();

      if (error || !data) {
        if (error) console.error('[insumos] error al crear', error);
        return;
      }

      setInsumos((prev) => [...prev, data]);
      resetInsumoForm();
    } finally {
      setGuardando(false);
    }
  };

  const desactivarInsumo = async (insumo) => {
    if (insumo.activo === false) return;

    setDesactivandoId(insumo.id);

    const { data, error } = await queryConNegocio(
      supabase.from('insumos').update({ activo: false }).eq('id', insumo.id),
      negocioId
    )
      .select()
      .single();

    if (error) {
      console.error('[insumos] error al desactivar', error);
    } else if (data) {
      setInsumos((prev) =>
        mostrarInactivos
          ? prev.map((entry) => (String(entry.id) === String(data.id) ? data : entry))
          : prev.filter((entry) => String(entry.id) !== String(data.id))
      );

      if (editandoInsumoId === insumo.id) {
        resetInsumoForm();
      }
    }

    setDesactivandoId(null);
  };

  return (
    <>
      <section className="pedido-formulario">
        <h2 className="formulario-titulo">
          {editandoInsumoId ? 'Editar insumo' : 'Agregar insumo'}
        </h2>
        <form className="formulario" onSubmit={handleInsumoSubmit}>
          <div className="formulario-campo">
            <label htmlFor="insumo-nombre">Nombre</label>
            <input
              id="insumo-nombre"
              name="nombre"
              type="text"
              value={insumoForm.nombre}
              onChange={handleInsumoFormChange}
              required
            />
          </div>
          <div className="formulario-campo">
            <label htmlFor="insumo-unidad_medida">Unidad de medida</label>
            <select
              id="insumo-unidad_medida"
              name="unidad_medida"
              value={insumoForm.unidad_medida}
              onChange={handleInsumoFormChange}
              required
            >
              {UNIDADES_MEDIDA_COMUNES.map((unidad) => (
                <option key={unidad} value={unidad}>
                  {unidad}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="guardar-btn" disabled={guardando}>
            {guardando
              ? 'Guardando...'
              : editandoInsumoId
                ? 'Guardar cambios'
                : 'Agregar insumo'}
          </button>
          {editandoInsumoId ? (
            <button type="button" className="cancelar-btn" onClick={resetInsumoForm}>
              Cancelar
            </button>
          ) : null}
        </form>
      </section>

      <section className="dashboard-lista">
        <label className="insumos-filtro-inactivos">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(event) => setMostrarInactivos(event.target.checked)}
          />
          Mostrar inactivos
        </label>

        {cargando ? (
          <p className="dashboard-vacio">Cargando insumos…</p>
        ) : insumosOrdenados.length === 0 ? (
          <p className="dashboard-vacio">
            {mostrarInactivos
              ? 'No hay insumos en el catálogo'
              : 'No hay insumos activos en el catálogo'}
          </p>
        ) : (
          <div className="pedidos-grid">
            {insumosOrdenados.map((insumo) => (
              <article key={insumo.id} className="pedido-tarjeta">
                <h2 className="pedido-cliente">{insumo.nombre}</h2>
                <p className="pedido-producto">Unidad: {insumo.unidad_medida}</p>
                {insumo.activo === false ? (
                  <p className="pedido-producto">Inactivo</p>
                ) : null}
                <div className="tarjeta-acciones">
                  <button
                    type="button"
                    className="editar-btn"
                    onClick={() => iniciarEdicionInsumo(insumo)}
                  >
                    Editar
                  </button>
                  {insumo.activo !== false ? (
                    <button
                      type="button"
                      className="eliminar-btn"
                      disabled={desactivandoId === insumo.id}
                      onClick={() => desactivarInsumo(insumo)}
                    >
                      {desactivandoId === insumo.id ? 'Desactivando…' : 'Desactivar'}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
