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

// --- Definiciones de PopupTemplates y Renderers ---

export const popupPoligonoCultivo = new PopupTemplate({
  title: 'Tipo de Cultivo: {tipo_cultivo}',
  outFields: ['*'],
  content: [
    {
      type: 'text',
      text: `<div style="text-align: center; font-weight: bold; font-size: 16px;">Datos del poligono de Cultivo: {nombre}</div>`,
    },
    {
      type: 'fields',
      fieldInfos: [
        createFieldInfo('cod_dni', 'Codigo Unico del poligono:', { isBold: true }),
        createFieldInfo('dni_participante', 'DNI del productor:', { isBold: true }),
        createFieldInfo('nombres', 'Nombre completo del productor:', { isBold: true }),
        createFieldInfo('celular_participante', 'Telefono del productor:', { isBold: true }),
        createFieldInfo('departamento', 'Departamento del Cultivo:', { isBold: true }),
        createFieldInfo('provincia', 'Provincia del Cultivo:', { isBold: true }),
        createFieldInfo('distrito', 'Distrito del Cultivo:', { isBold: true }),
        createFieldInfo('n_parcela', 'Numero del Cultivo:', { isBold: true }),
        createFieldInfo('variedad', 'Variedad del Cultivo:', { isBold: true }),
        createFieldInfo('oficina_zonal', 'Oficina Zonal:', { isBold: true }),
        createFieldInfo('organizacion', 'Organizacion:', { isBold: true }),
        createFieldInfo('fecha_regitro', 'Fecha de registro:', {
          isBold: true,
          format: { dateFormat: 'short-date' },
        }),
        createFieldInfo('area_cultivo', 'Area del Cultivo: (has)', {
          isBold: true,
          format: { places: 3, digitSeparator: true },
        }),
        createFieldInfo('codigo_plan', 'CODIGO DEL PLAN:', {
          isBold: true,
          format: { places: 3, digitSeparator: true },
        }),
        createFieldInfo('nombre_plan', 'NOMBRE DEL PLAN:', {
          isBold: true,
          format: { places: 3, digitSeparator: true },
        }),
      ],
    },
  ],
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
