import {
  PopupTemplate,
  SimpleMarkerSymbol,
  SimpleRenderer,
  UniqueValueRenderer,
} from './arcgis-imports';

/**
 * Helper para crear una configuración de campo (`fieldInfo`) para un PopupTemplate.
 * Reduce la repetición y centraliza el estilo.
 * @param fieldName - El nombre del campo en el servicio.
 * @param label - La etiqueta que se mostrará en el popup.
 * @param options - Opciones adicionales como formato, visibilidad y si el texto debe ir en negrita.
 * @returns Un objeto de configuración de FieldInfo.
 */
const createFieldInfo = (
  fieldName: string,
  label: string,
  options: {
    isBold?: boolean;
    format?: __esri.FieldInfoFormatProperties;
    visible?: boolean;
  } = {}
): __esri.FieldInfoProperties => {
  const { isBold = false, format, visible = true } = options;
  return {
    fieldName: fieldName.trim(), // Limpia espacios en blanco al final del nombre del campo
    label: isBold ? `<b><font>${label}</font></b>` : label,
    visible: visible,
    stringFieldOption: 'text-box',
    ...(format && { format }),
  };
};

/**
 * Helper para formatear una fila de campo para el popup personalizado.
 * @param label La etiqueta a mostrar.
 * @param value El valor del campo.
 * @param options Opciones como unidades o precisión para números.
 * @returns Una cadena HTML con la fila del campo o una cadena vacía si el valor no es válido.
 */
function formatPopupField(label: string, value: any, options: { unit?: string, precision?: number } = {}): string {
  if (value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim() === '')) {
    return `
    <div style="display: grid; grid-template-columns: 130px 1fr; margin-bottom: 8px; font-size: 13px;">
      <strong style="color: #1e40af;">${label}:</strong>
      <span style="color: #9ca3af; font-style: italic;">No disponible</span>
    </div>
  `;
  }

  let displayValue = value;
  if (typeof value === 'number' && options.precision !== undefined) {
    displayValue = value.toFixed(options.precision);
  }
  if (options.unit) {
    displayValue += ` ${options.unit}`;
  }

  return `
    <div style="display: grid; grid-template-columns: 130px 1fr; margin-bottom: 8px; font-size: 13px;">
      <strong style="color: #1e40af;">${label}:</strong>
      <span style="color: #4b5563;">${displayValue}</span>
    </div>
  `;
}

// --- Definiciones de PopupTemplates y Renderers ---

export const popupPoligonoCultivo = new PopupTemplate({
  title: '',
  outFields: ['*'],
  content: (feature: { graphic: __esri.Graphic }): string => {
    const attrs = feature.graphic.attributes;

    // Función para formatear fechas de manera segura
    const formatDate = (dateValue: any) => {
      if (!dateValue) return 'N/A';
      // La fecha puede venir como número (timestamp) o string
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      return date.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const popupHeader = `
      <div style="background-color: #0D9BD7; color: white; font-weight: bold; font-size: 16px; padding: 15px; text-align: center; margin: -5px -5px 10px -5px; border-top-left-radius: 4px; border-top-right-radius: 4px;">
        TIPO DE CULTIVO: ${attrs.tipo_cultivo || 'No especificado'}
      </div>`;

    const participanteInfo = `
      <details open>
        <summary style="font-weight: bold; cursor: pointer; margin-bottom: 8px; padding: 9px 8px; background-color: #0D9BD7; color: white; border-radius: 4px;">Datos del Participante</summary>
        <div style="padding-left: 15px; border-left: 2px solid #93c5fd; margin-left: 6px; padding-top: 8px;">
          ${formatPopupField('DNI', attrs.dni_participante)}
          ${formatPopupField('Nombre', attrs.nombres)}
          ${formatPopupField('Fec. Nacimiento', formatDate(attrs['fecha_nacimiento ']))}
          ${formatPopupField('Teléfono', attrs.celular_participante)}

        </div>
      </details>
    `;
    const cultivoInfo = `
      <details>
        <summary style="font-weight: bold; cursor: pointer; margin-top: 15px; margin-bottom: 8px; padding: 9px 8px; background-color: #0D9BD7; color: white; border-radius: 4px;">Datos del Cultivo</summary>
        <div style="padding-left: 15px; border-left: 2px solid #93c5fd; margin-left: 6px; padding-top: 8px;">
          ${formatPopupField('Código PPA', attrs.codigo_ppa)}
          ${formatPopupField('Año Instalación', attrs.anio_instalacion)}
          ${formatPopupField('Año Incorporación', attrs.anio_incorporacion)}
          ${formatPopupField('Tipo', attrs.tipo_cultivo)}
          ${formatPopupField('Variedad', attrs.variedad)}
          ${formatPopupField('N° Parcela', attrs.n_parcela)}
          ${formatPopupField('Área (ha)', attrs.area_cultivo, { precision: 3 })}
          ${formatPopupField('Fec. Registro', formatDate(attrs['fecha_levantamiento ']))}
          ${formatPopupField('Organización', attrs.organizacion)}
        </div>
      </details>
    `;
    const ubicacionInfo = `
      <details>
        <summary style="font-weight: bold; cursor: pointer; margin-top: 15px; margin-bottom: 8px; padding: 9px 8px; background-color: #0D9BD7; color: white; border-radius: 4px;">Ubicación y Plan</summary>
        <div style="padding-left: 15px; border-left: 2px solid #93c5fd; margin-left: 6px; padding-top: 8px;">

        ${formatPopupField('Oficina Zonal', attrs.oficina_zonal)}
          ${formatPopupField('Departamento', attrs.departamento)}
          ${formatPopupField('Provincia', attrs.provincia)}
          ${formatPopupField('Distrito', attrs.distrito)}
          ${formatPopupField('Caserío', attrs.caserio)}
          ${formatPopupField('Cód. Único', attrs.cod_dni)}
          ${formatPopupField('PTA / POA', attrs.codigo_plan)}
          ${formatPopupField('Desc. Plan', attrs.nombre_plan)}
          ${formatPopupField('Coordenada (X)', attrs.x_coord, { precision: 5 })}
          ${formatPopupField('Coordenada (Y)', attrs.y_coord, { precision: 5 })}
        </div>
      </details>
    `;
    const observacionesInfo = `
      <details>
        <summary style="font-weight: bold; cursor: pointer; margin-top: 15px; margin-bottom: 8px; padding: 9px 8px; background-color: #0D9BD7; color: white; border-radius: 4px;">Observaciones</summary>
        <div style="padding-left: 15px; border-left: 2px solid #93c5fd; margin-left: 6px; padding-top: 8px; color: #4b5563; font-style: italic;">
          ${attrs.observaciones || 'Sin observaciones.'}
        </div>
      </details>
    `;
    const poligonoTitle = attrs.nombre
      ? `<div style="text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 12px; color: #1e3a8a;">Polígono: ${attrs.nombre}</div>`
      : '';
    return `
      <div class="esri-feature-content" style="padding: 5px; font-family: Avenir, 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px;">
        ${window.innerWidth < 768 ? `
          ${popupHeader}
          ${poligonoTitle}
          ${participanteInfo}
          ${cultivoInfo}
        ` : `
          ${popupHeader}
          ${poligonoTitle}
          ${participanteInfo}
          ${cultivoInfo}
          ${ubicacionInfo}
          ${observacionesInfo}
        `}
      </div>
    `;
  }
});

export const popupLimitesOficinaZonal = new PopupTemplate({
  title: '',
  outFields: ['*'],
  content: [
    {
      type: 'text',
      text: `<div style="text-align: center; font-weight: bold; font-size: 16px;">Ambito de la Oficina Zonal: {nombre}</div>`,
    },
    {
      type: 'fields',
      fieldInfos: [
        createFieldInfo('oz_devida', 'Oficina Zonal:', { isBold: true }),
        createFieldInfo('representante', 'Representante:', { isBold: true }),
        createFieldInfo('direccion', 'Direccion:', { isBold: true }),
        createFieldInfo('telefono', 'Telefono:', { isBold: true }),
        createFieldInfo('correo', 'Correo:', { isBold: true }),
        createFieldInfo('area_st', 'Area (M ha):', {
          isBold: true,
          format: { places: 3, digitSeparator: true },
        }),
        createFieldInfo('perimetro_st', 'Perímetro (Km):', {
          isBold: true,
          format: { places: 3, digitSeparator: true },
        }),
      ],
    },
  ],
});

export const caribANP = new PopupTemplate({
  title: '',
  outFields: ['*'],
  content: [
    {
      type: 'text',
      text: `<div style="text-align: center; font-weight: bold; font-size: 16px;">Area Natural Protegida: {nombre}</div>`,
    },
    {
      type: 'fields',
      fieldInfos: [createFieldInfo('name_es', 'Nombre:', { isBold: true })],
    },
  ],
});

export const caribZA = new PopupTemplate({
  title: '',
  outFields: ['*'],
  content: [
    {
      type: 'text',
      text: `
        <div style="text-align: center; font-weight: bold; font-size: 18px; color: #2E7D32; margin-bottom: 8px;">
          Zona de Amortiguamiento
          <br>
          <span style="font-size: 16px; color: #1565C0;">{c_nomb}</span>
        </div>
        <hr style="border-top: 1px solid #ccc; margin: 8px 0;">
      `,
    },
    {
      type: 'fields',
      fieldInfos: [createFieldInfo('anp_nomb', 'Área Natural Protegida:')],
    },
  ],
});

export const restCaribSurveyPercepcionCacao = new PopupTemplate({
  title: '',
  outFields: ['*'],
  expressionInfos: [
    {
      name: 'nombreTecnico',
      title: 'Técnico interpretado',
      expression: `
        var cod = $feature.tecnico;
        if (cod == "08") { return "Castolo Jose Ramos Cristobal"; }
        if (cod == "01") { return "Susana Lucia Velarde Rosales"; }
        if (cod == "03") { return "Felix Quispe Bendezu"; }
        if (cod == "06") { return "Dina Ayala Rodriguez"; }
        return "Código desconocido: " + cod;
      `,
    },
    {
      name: 'fechaHoraFormateada',
      title: 'Fecha y hora formateada',
      expression: `
        var f = $feature.fecha;
        if (IsEmpty(f)) { return "Sin fecha"; }
        return Text(f, 'DD/MM/YYYY HH:mm');
      `,
    },
    {
      name: 'fechaHoraFormateadaEnvio',
      title: 'Fecha y hora formateada',
      expression: `
        var f = $feature.EditDate;
        if (IsEmpty(f)) { return "Sin fecha"; }
        return Text(f, 'DD/MM/YYYY HH:mm');
      `,
    },
  ],
  content: [
    {
      type: 'text',
      text: `<div style="text-align: center; font-weight: bold; font-size: 16px;">Nro PTA: {nro_pta}</div>`,
    },
    {
      type: 'text',
      text: `<div style="margin-top: 8px;"><b><font>Técnico:</font></b> {expression/nombreTecnico}</div>`,
    },
    {
      type: 'text',
      text: `<div><b><font>Fecha de monitoreo:</font></b> {expression/fechaHoraFormateada}</div>`,
    },
    {
      type: 'text',
      text: `<div><b><font>Fecha de Envío:</font></b> {expression/fechaHoraFormateadaEnvio}</div>`,
    },
    {
      type: 'attachments',
    },
  ],
});

export const restCaribSurveyPercepcionCafe = new PopupTemplate({
  title: '',
  outFields: ['*'],
  expressionInfos: [
    {
      name: 'nombreTecnico',
      title: 'Técnico interpretado',
      expression: `
        var cod = $feature.tecnico;
        if (cod == "08") { return "Castolo Jose Ramos Cristobal"; }
        if (cod == "01") { return "Susana Lucia Velarde Rosales"; }
        if (cod == "03") { return "Felix Quispe Bendezu"; }
        if (cod == "06") { return "Dina Ayala Rodriguez"; }
        return "Código desconocido: " + cod;
      `,
    },
    {
      name: 'fechaHoraFormateada',
      title: 'Fecha y hora formateada',
      expression: `
        var f = $feature.fecha;
        if (IsEmpty(f)) { return "Sin fecha"; }
        return Text(f, 'DD/MM/YYYY HH:mm');
      `,
    },
    {
      name: 'fechaHoraFormateadaEnvio',
      title: 'Fecha y hora formateada',
      expression: `
        var f = $feature.EditDate;
        if (IsEmpty(f)) { return "Sin fecha"; }
        return Text(f, 'DD/MM/YYYY HH:mm');
      `,
    },
  ],
  content: [
    {
      type: 'text',
      text: `<div style="text-align: center; font-weight: bold; font-size: 16px;">Nro PTA: {nro_pta}</div>`,
    },
    {
      type: 'text',
      text: `<div style="margin-top: 8px;"><b><font>Técnico:</font></b> {expression/nombreTecnico}</div>`,
    },
    {
      type: 'text',
      text: `<div><b><font>Fecha de monitoreo:</font></b> {expression/fechaHoraFormateada}</div>`,
    },
    {
      type: 'text',
      text: `<div><b><font>Fecha de Envío:</font></b> {expression/fechaHoraFormateadaEnvio}</div>`,
    },
    {
      type: 'attachments',
    },
  ],
});

export const cafeRenderer = new SimpleRenderer({
  symbol: new SimpleMarkerSymbol({
    color: [255, 0, 0, 0.8], // rojo
    outline: { color: [0, 0, 0], width: 1 },
    size: 10,
    style: 'circle',
  }),
});

export const recopilacionRenderer = new SimpleRenderer({
  symbol: new SimpleMarkerSymbol({
    color: [139, 69, 19, 0.9], // café sólido
    outline: {
      color: [255, 255, 255, 1], // borde blanco como GPS
      width: 1,
    },
    size: 12,
    style: 'circle',
  }),
});

export const restCaribRecopilacion = new PopupTemplate({
  title: 'Ficha de Recopilación',
  outFields: ['*'],
  content: [
    {
      type: 'text',
      text: `<div style="text-align: center; font-weight: bold; font-size: 16px;">PARTICIPANTE: {nombre_participante}</div>`,
    },
    {
      type: 'fields',
      fieldInfos: [
        createFieldInfo('dni_participante', 'DNI del participante'),
        createFieldInfo('objectid', 'ID interno', { visible: false }),
        createFieldInfo('globalid', 'ID global', { visible: false }),
      ],
    },
    {
      type: 'attachments',
    },
  ],
});

export const cultivosRenderer = new UniqueValueRenderer({
  field: 'tipo_cultivo',
  defaultLabel: 'OTROS',
  defaultSymbol: {
    type: 'simple-fill',
    color: [150, 150, 150, 0.5], // Gris
    outline: {
      color: 'white',
      width: 1,
    },
  } as any,
  uniqueValueInfos: [
    {
      value: 'CACAO',
      label: 'CACAO',
      symbol: {
        type: 'simple-fill',
        color: '#734C24', // Marrón
        outline: {
          color: 'yellow',
          width: 1,
        },
      } as any,
    },
    {
      value: 'CAFE',
      label: 'CAFÉ',
      symbol: {
        type: 'simple-fill',
        color: '#4C7300', // Verde Oscuro
        outline: {
          color: 'white',
          width: 1,
        },
      } as any,
    },
  ],
});
