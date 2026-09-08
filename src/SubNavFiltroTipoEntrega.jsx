import { SUBTABS_FILTRO_TIPO_ENTREGA } from './recogerDomicilioHelpers';

export default function SubNavFiltroTipoEntrega({
  valor,
  conteos,
  onChange,
  ariaLabel,
}) {
  return (
    <nav
      className="recoger-domicilio-subtabs-tipo-entrega"
      aria-label={ariaLabel}
    >
      {SUBTABS_FILTRO_TIPO_ENTREGA.map(({ value, label }) => {
        const contador = conteos[value] ?? 0;

        return (
          <button
            key={value}
            type="button"
            className={`recoger-domicilio-subtab-tipo-entrega${
              valor === value ? ' activo' : ''
            }`}
            aria-pressed={valor === value}
            onClick={() => onChange(value)}
          >
            {label} ({contador})
          </button>
        );
      })}
    </nav>
  );
}
