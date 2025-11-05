import { ElementRef, Injectable } from '@angular/core';
//Libreria actual de ArcGIS 4.33
import '@arcgis/map-components/components/arcgis-search';
import { LayerConfig } from '../interfaces/layerConfig';
import proj4 from 'proj4';
import {
  EsriMap,
  Graphic,
  PopupTemplate,
  reactiveUtils,
  geometryEngineAsync,
  MapView,
  CSVLayer,
  FeatureLayer,
  GeoJSONLayer,
  GraphicsLayer,
  MapImageLayer,
  WebTileLayer,
  SimpleRenderer,
  UniqueValueRenderer,
  SimpleMarkerSymbol,
  CoordinateConversion,
  Expand,
  Legend,
  Zoom,
  StatisticDefinition
} from '../interfaces/arcgis-imports';
//Importación de Popup Template de ArcGIS 4.33
import {
  cultivosRenderer,
  popupPoligonoCultivo,
  recopilacionRenderer,
  restCaribRecopilacion,
} from '../interfaces/popup-templates';
import { TourService } from './tour.service';

export interface CustomSearchResult {
  feature: Graphic;
  layerName: string;
  displayValue: string;
  secondaryInfo?: string;
}

export interface OficinaStats {
  totalHectareas: number;
  hectareasCacao: number;
  hectareasCafe: number;
  totalFamilias: number;
  familiasCacao: number;
  familiasCafe: number;
  familiasAmbos: number;
}


@Injectable({
  providedIn: 'root',
})
export class GeovisorSharedService {
  public mapa = new EsriMap({ basemap: 'satellite'});
  public view: MapView | null = null;
  private coordinateMarkerLayer = new GraphicsLayer({ id: 'coordinate-marker'});
  private highlightLayer = new GraphicsLayer({ id: 'highlight-overlaps' });
  private previousLayerVisibility: Map<string, boolean> = new Map();
  private _oficinasZonalesCache: { nombre: string }[] | null = null;

  //Método auxiliar para mostrar los mensajes toast.
    public showToast(
      mensaje: string,
      tipo: 'success' | 'error' | 'info' | 'warning' = 'success',
      autoHide: boolean = true
    ): void {
      let toast = document.getElementById('toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.opacity = '0';
        toast.style.zIndex = '10000';
        document.body.appendChild(toast);
      }
      toast!.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:320px;">
          <span>${mensaje}</span>
          <button id="toast-close" style="background:none;border:none;color:white;font-weight:bold;cursor:pointer;">✖</button>
        </div>
      `;
      toast!.className = `
        fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
        px-4 py-2 rounded shadow text-white
        ${tipo === 'success' ? 'bg-green-600' : tipo === 'error' ? 'bg-red-600' : tipo === 'warning' ? 'bg-orange-500' : 'bg-blue-600'}
        text-center
        transition-opacity duration-500
      `;
      toast!.style.opacity = '1';
      if (autoHide) {
        setTimeout(() => (toast!.style.opacity = '0'), 10000);
      }
      document.getElementById('toast-close')?.addEventListener('click', () => {
        toast!.style.opacity = '0';
      });
    }

  //Servicio SISCOD-DEVIDA
  public restSISCOD = 'https://siscod.devida.gob.pe/server/rest/services/DPM_PIRDAIS_CULTIVOS_PRODUCCION/MapServer';
  public restCaribSurvey = {
    serviceBase:
      'https://services8.arcgis.com/tPY1NaqA2ETpJ86A/ArcGIS/rest/services',
    capas: {
      infraestructura:
        'FICHA_DE_MONITOREO_TIPOLOGÍA_INFRAESTRUCTURA_vista/FeatureServer/0',
      cacao:
        'CUESTIONARIO_DE_PERCEPCION_DE_LA_FAMILIA_–_PTA_DEVIDA_vista/FeatureServer/0',
      cafe: 'CUESTIONARIO_DE_PERCEPCION_DE_LA_FAMILIA_%E2%80%93_CAFE_vista/FeatureServer/0',
      registroForestal: 'REGISTRO_FORESTAL_vista/FeatureServer/0',
      medidasAmbientales: 'MEDIDAS_AMBIENTALES_vista/FeatureServer/0',
      recopilacion:
        'survey123_b76b6ab3a7fa403384473a05b7ecce49_results/FeatureServer/0',
    },
  };
  public layers: LayerConfig[] = [
    {
      type: 'map-image',
      title: 'POLIGONOS DE CULTIVO',
      url: `${this.restSISCOD}`,
      visible: true,
      opacity: 0.8,
      minScale: 0,
      maxScale: 0,
      group: '(DAIS)',
      // 🔹 Aquí defines las subcapas visibles
      sublayers: [
        {
          id: 1,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
          popupTemplate: popupPoligonoCultivo,
          renderer: cultivosRenderer,
        },
      ],
    },
    {
      type: 'map-image',
      title: 'ANP - AREAS NATURALES PROTEGIDAS',
      url: `https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/OCAPAS_SERNANP/MapServer`,
      visible: false,
      opacity: 0.5,
      maxScale: 0,
      group: '(SERFOR)',
      sublayers: [
        {
          id: 5,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    {
      type: 'map-image',
      title: 'MONITOREO DEFORESTACION',
      url: `https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/Monitoreo_Deforestacion_Tala/MapServer`,
      visible: false,
      opacity: 0.5,
      minScale: 0,
      maxScale: 0,
      group: '(SERFOR)',
      sublayers: [
        {
          id: 1,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    {
      type: 'map-image',
      title: 'COMUNIDADES NATIVAS',
      url: `https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/OCAPAS_SERNANP/MapServer`,
      visible: false,
      opacity: 0.5,
      minScale: 0,
      maxScale: 0,
      group: '(SERFOR)',
      sublayers: [
        {
          id: 27,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    {
      type: 'map-image',
      title: 'ZA-ZONAS DE AMORTIGUAMIENTO',
      url: `https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/OCAPAS_SERNANP/MapServer`,
      visible: false,
      opacity: 0.5,
      minScale: 0,
      maxScale: 0,
      group: '(SERFOR)',
      sublayers: [
        {
          id: 4,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    {
      type: 'map-image',
      title: 'ACR-AREAS DE CONSERVACION REGIONAL',
      url: `https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/OCAPAS_SERNANP/MapServer`,
      visible: false,
      opacity: 0.5,
      minScale: 0,
      maxScale: 0,
      group: '(SERFOR)',
      sublayers: [
        {
          id: 6,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    {
      type: 'map-image',
      title: 'BPP-BOSQUE DE PRODUCCION PERMANENTE',
      url: `https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/Ordenamiento_Forestal/MapServer`,
      visible: true,
      opacity: 0.5,
      minScale: 0,
      maxScale: 0,
      group: '(SERFOR)',
      sublayers: [
        {
          id: 1,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    {
      type: 'map-image',
      title: 'OFICINAS ZONALES',
      url: this.restSISCOD,
      visible: false, // Establecer la visibilidad por defecto en false
      opacity: 1,
      minScale: 0,
      maxScale: 0,
      group: 'CARTOGRAFIA DEVIDA',
      sublayers: [
        {
          id: 0,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    //(Limites Politicos)
    {
      type: 'map-image',
      title: 'DISTRITOS',
      url: this.restSISCOD,
      visible: true,
      opacity: 0.9,
      minScale: 0,
      maxScale: 0,
      group: 'LIMITES POLITICOS',
      sublayers: [
        {
          id: 6,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    {
      type: 'map-image',
      title: 'PROVINCIA',
      url: this.restSISCOD,
      visible: true,
      opacity: 0.9,
      minScale: 0,
      maxScale: 0,
      group: 'LIMITES POLITICOS',
      sublayers: [
        {
          id: 5,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    {
      type: 'map-image',
      title: 'DEPARTAMENTO',
      url: this.restSISCOD,
      visible: true,
      opacity: 0.9,
      minScale: 0,
      maxScale: 0,
      group: 'LIMITES POLITICOS',
      sublayers: [
        {
          id: 4,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
          renderer: new SimpleRenderer({
            symbol: {
              type: 'simple-fill',
              color: [0, 0, 0, 0], // Relleno transparente
              outline: {
                color: [255, 255, 0, 1], // Borde amarillo
                width: 2,
              },
            } as any,
          }),
        },
      ],
    },
    {
      type: 'map-image',
      title: 'PERU',
      url: this.restSISCOD,
      visible: true,
      opacity: 0.9,
      minScale: 0,
      maxScale: 0,
      group: 'LIMITES POLITICOS',
      sublayers: [
        {
          id: 3,
          visible: true,
          labelsVisible: true,
          minScale: 0,
          maxScale: 0,
        },
      ],
    },
    {
      type: 'feature',
      title: 'VISITAS DE MONITOREO',
      url: `${this.restCaribSurvey.serviceBase}/${this.restCaribSurvey.capas.recopilacion}`,
      labelingInfo: [],
      popupTemplate: restCaribRecopilacion,
      renderer: recopilacionRenderer,
      visible: false,
      labelsVisible: false,
      opacity: 1,
      group: '(DAIS)',
    },
  ];

  public lis: [] = [];
  public searchTerm = '';
  public filteredArray: [] = [];
  public gcsLongitude = '00.00';
  public gcsLatitude = '00.00';
  public utmZone = '00.00';
  public utmEast = '00.00';
  public utmNorth = '00.00';
  public scale = '00.00';
  private scaleWatcher: __esri.WatchHandle | null = null;
  public legend!: Legend;

  constructor(private tourService: TourService) {
    this.mapa.add(this.highlightLayer);
    this.mapa.add(this.coordinateMarkerLayer);
  }

  initializeMap(mapViewEl: ElementRef): Promise<void> {
    // --- INICIO DE LA MEJORA ---
    // Si la vista ya existe, solo re-adjuntamos el contenedor y salimos.
    // Esto evita la recreación del mapa y la duplicación de widgets.
    if (this.view) {
      this.view.container = mapViewEl.nativeElement;
      return this.view.when(); // Devolvemos la promesa existente.
    }
    // --- FIN DE LA MEJORA ---
    this.layers.forEach((layerConfig) => {
      const hasValidLayerId = /\/\d+$/.test(layerConfig.url);
      const isMapImage = /\/MapServer$/.test(layerConfig.url);
      let layer: __esri.Layer;
      if (hasValidLayerId) {
        // 🔹 Es un FeatureLayer
        const layerOptions: __esri.FeatureLayerProperties = {
          url: layerConfig.url,
          title: layerConfig.title,
          visible: layerConfig.visible,
        };
        if (layerConfig.popupTemplate)
          layerOptions.popupTemplate = layerConfig.popupTemplate;
        if (layerConfig.renderer) layerOptions.renderer = layerConfig.renderer;
        if (layerConfig.labelingInfo)
          layerOptions.labelingInfo = layerConfig.labelingInfo;
        if (layerConfig.labelsVisible !== undefined) {
          layerOptions.labelsVisible = layerConfig.labelsVisible;
        }
        if (layerConfig.outFields)
          layerOptions.outFields = layerConfig.outFields;
        if (layerConfig.maxScale !== undefined)
          layerOptions.maxScale = layerConfig.maxScale;
        if (layerConfig.minScale !== undefined)
          layerOptions.minScale = layerConfig.minScale;
        if (layerConfig.featureReduction)
          layerOptions.featureReduction = layerConfig.featureReduction;
        if (layerConfig.opacity !== undefined)
          layerOptions.opacity = layerConfig.opacity;
        layer = new FeatureLayer(layerOptions);
      } else if (isMapImage) {
        // 🔹 Es un MapImageLayer
        const layerOptions: __esri.MapImageLayerProperties = {
          url: layerConfig.url,
          title: layerConfig.title,
          visible: layerConfig.visible,
          opacity: layerConfig.opacity ?? 1,
        };
        if (layerConfig.minScale !== undefined)
          layerOptions.minScale = layerConfig.minScale;
        if (layerConfig.maxScale !== undefined)
          layerOptions.maxScale = layerConfig.maxScale;
        if (layerConfig.sublayers)
          layerOptions.sublayers = layerConfig.sublayers;
        layer = new MapImageLayer(layerOptions);
      } else {
        // 🔹 Es un WebTileLayer
        layer = new WebTileLayer({
          urlTemplate: layerConfig.url,
          title: layerConfig.title,
          visible: layerConfig.visible,
          opacity: layerConfig.opacity ?? 1,
        });
      }
      this.mapa.add(layer);
    });

    //Creacion de la Vista del Mapa
    this.view = new MapView({
      container: mapViewEl.nativeElement,
      map: this.mapa,
      center: [-74.0, -10.0],
      zoom: 6,
      rotation: 0,
      constraints: {
        maxZoom: 25,
        minZoom: 6,
        snapToZoom: false,
      },
      padding: { top: 0 },
      ui: {
        components: [],
      },
    });

    this.mapa.layers.on('after-add', (event) => {
      const lyr = event.item;
      if (lyr.type === 'feature') {
        (lyr as __esri.FeatureLayer)
          .load()
          .then(() => this.actualizarSelectCapas());
      } else if (lyr.type === 'map-image') {
        (lyr as __esri.MapImageLayer).load().then(() => {
          // Una vez que la capa de imagen de mapa está cargada,
          // sus subcapas también lo están.
          this.actualizarSelectCapas();
        });
      }
    });

    //Ver la escala en el mapa
    this.view.when(() => {
      this.actualizarSelectCapas();
      this.mapa.layers.on('change', () => {
        this.actualizarSelectCapas();
      });
      // Limpiamos cualquier watcher anterior para evitar fugas de memoria.
      if (this.scaleWatcher) {
        this.scaleWatcher.remove();
      }
      // Creamos un nuevo watcher y guardamos su manejador para poder limpiarlo después.
      this.scaleWatcher = reactiveUtils.watch(
        () => this.view!.scale,
        (scale) => {
          this.scale = this.formatScale(scale);
        }, { initial: true } // { initial: true } para que se ejecute una vez al inicio
      );
    });
    //Widgets del Visor
    this.view.ui.add(new Zoom({ view: this.view }), {
      position: 'top-right',
      index: 1,
    });

    const homeEl = document.createElement('arcgis-home') as any;
    homeEl.autoDestroyDisabled = true;
    homeEl.view = this.view;
    this.view.ui.add(homeEl, { position: 'top-right', index: 2 });

    const locateEl = document.createElement('arcgis-locate') as any;
    locateEl.autoDestroyDisabled = true;
    locateEl.view = this.view;
    this.view.ui.add(locateEl, { position: 'top-right', index: 3 });

    const galleryEl = document.createElement('arcgis-basemap-gallery') as any;
    galleryEl.autoDestroyDisabled = true;
    galleryEl.view = this.view;
    const expand = new Expand({
      view: this.view,
      content: galleryEl,
      expandTooltip: 'Galería de Mapas Base',
      expandIcon: 'basemap',
    });
    this.view.ui.add(expand, { position: 'top-right', index: 4 });

    function toggleGalleryWidget() {
      if (!expand.container) return;
      if (window.innerWidth < 768) {
        expand.container.style.display = 'none';
        expand.collapse();
      } else {
        expand.container.style.display = 'block';
      }
    }

    //Widget para cargar GeoJSON
    const uploadEl = document.createElement('div');
    uploadEl.className = 'file-upload-widget p-2 bg-white rounded shadow';
    const inputEl = document.createElement('input');
    inputEl.type = 'file';
    inputEl.accept = '.json,.geojson,.csv';
    inputEl.style.cursor = 'pointer';
    inputEl.className = 'border rounded p-1';
    inputEl.addEventListener('change', (evt: Event) => {
      const target = evt.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        this.dataImport(file).then(() => {
          target.value = ''; // limpiar input después de cargar
        });
      }
    });
    uploadEl.appendChild(inputEl);
    const expanduploadEl = new Expand({
      view: this.view,
      content: uploadEl,
      expandTooltip: 'Cargar archivo en formato GeoJSON',
      expandIcon: 'upload',
    });
    this.view.ui.add(expanduploadEl, { position: 'top-right', index: 5 });
    function toggleUploadWidget() {
      if (!expanduploadEl.container) return;
      if (window.innerWidth < 768) {
        expanduploadEl.container.style.display = 'none';
        expanduploadEl.collapse();
      } else {
        expanduploadEl.container.style.display = 'block';
      }
    }

    //Widget para limpiar capas GeoJSON
    const clearGeoJSONEl = document.createElement('div');
    clearGeoJSONEl.className = 'clear-geojson-widget p-2 bg-white rounded shadow';
    const clearButton = document.createElement('button');
    clearButton.textContent = '🗑️ Limpiar GeoJSON';
    clearButton.className = `
                      px-4 py-1
                      bg-red-600 hover:bg-red-700
                      text-white font-semibold rounded
                      text-base
                      transition-colors
                      mx-auto
                      block
                    `;
    clearButton.addEventListener('click', () => this.clearGeoJSONLayers());
    clearGeoJSONEl.appendChild(clearButton);
    const expandClearGeoJSON = new Expand({
      view: this.view,
      content: clearGeoJSONEl,
      expandTooltip: 'Limpiar capas GeoJSON importadas',
      expandIcon: 'trash',
    });
    this.view.ui.add(expandClearGeoJSON, { position: 'top-right', index: 6 });
    function toggleClearGeoJSONWidget() {
      if (!expandClearGeoJSON.container) return;
      if (window.innerWidth < 768) {
        expandClearGeoJSON.container.style.display = 'none';
        expandClearGeoJSON.collapse();
      } else {
        expandClearGeoJSON.container.style.display = 'block';
      }
    }

    //Widget para ANALISIS ESPACIAL CON BPP-SERFOR
        const uploadEl6 = document.createElement('div');
        uploadEl6.className = 'file-upload-widget p-2 bg-white rounded shadow';
        const titleEl = document.createElement('div');
        titleEl.textContent = 'Selecciona capas para superposición:';
        titleEl.className = 'mb-2 font-semibold';
        uploadEl6.appendChild(titleEl);
        const selectEl = document.createElement('select');
        selectEl.multiple = true;
        selectEl.className = 'w-full p-1 border rounded mb-2';
        uploadEl6.appendChild(selectEl);
        const buttonEl = document.createElement('button');
        buttonEl.textContent = '🔎 Analizar superposición';
        buttonEl.className = `
                      px-4 py-1
                      bg-blue-600 hover:bg-blue-700
                      text-white font-semibold rounded
                      text-base
                      transition-colors
                      mx-auto
                      block
                    `;
        uploadEl6.appendChild(buttonEl);
        const capasVisibles: __esri.FeatureLayer[] = [];
        this.mapa.layers.forEach((lyr) => {
          const layerType = (lyr as any).type;
          if (layerType === 'feature' && lyr.visible) {
            capasVisibles.push(lyr as __esri.FeatureLayer);
            const opt = document.createElement('option');
            opt.value = lyr.id;
            opt.text = (lyr as any).title || (lyr as any).name || lyr.id;
            selectEl.appendChild(opt);
          } else if (layerType === 'map-image' && lyr.visible) {
            const mapImg = lyr as __esri.MapImageLayer;
            mapImg.sublayers?.forEach((sub) => {
              if (sub.visible && 'queryFeatures' in sub) {
                const fl = sub as unknown as __esri.FeatureLayer;
                capasVisibles.push(fl);
                const opt = document.createElement('option');
                opt.value = fl.id.toString();
                opt.text =
                  (sub as any).title || (sub as any).name || `${mapImg.title}`;
                selectEl.appendChild(opt);
              }
            });
          }
        });
        buttonEl.onclick = async () => {
          try {
            await this.analizarSuperposicionSERFOR();
          } catch (err) {

          }
        };
        const expandAnalisis = new Expand({
          view: this.view,
          content: uploadEl6,
          expandTooltip: 'Analizar superposición con Bosque de Protección Permanente',
          expandIcon: 'parcel-layer',
        });
        this.view.ui.add(expandAnalisis, { position: 'top-right', index: 7 });
        function toggleAnalisisWidget() {
          if (!expandAnalisis.container) return;
          if (window.innerWidth < 768) {
            expandAnalisis.container.style.display = 'none';
            expandAnalisis.collapse();
          } else {
            expandAnalisis.container.style.display = 'block';
          }
        }

        //Widget para ANALISIS ESPACIAL CON POLIGONOS DE CULTIVO
        const uploadEl7 = document.createElement('div');
        uploadEl7.id = 'analisis-cultivo-widget';
        uploadEl7.className = 'p-2 bg-white rounded shadow';
        const titleCultivoEl = document.createElement('div');
        titleCultivoEl.textContent = 'Selecciona capas para superposición:';
        titleCultivoEl.className = 'mb-2 font-semibold';
        uploadEl7.appendChild(titleCultivoEl);
        const selectCultivoEl = document.createElement('select');
        selectCultivoEl.multiple = true;
        selectCultivoEl.className = 'w-full p-1 border rounded mb-2';
        uploadEl7.appendChild(selectCultivoEl);
        const buttonCultivoEl = document.createElement('button');
        buttonCultivoEl.textContent = '🔎 Analizar superposición';
        buttonCultivoEl.className = `
                  px-4 py-1
                  bg-blue-600 hover:bg-blue-700
                  text-white font-semibold rounded
                  text-base
                  transition-colors
                  mx-auto
                  block
                `;
        uploadEl7.appendChild(buttonCultivoEl);
        const capasVisiblesCultivo: __esri.FeatureLayer[] = [];
        this.mapa.layers.forEach((lyr) => {
          const layerType = (lyr as any).type;
          if (layerType === 'feature' && lyr.visible) {
            capasVisiblesCultivo.push(lyr as __esri.FeatureLayer);
            const opt = document.createElement('option');
            opt.value = lyr.id;
            opt.text = (lyr as any).title || (lyr as any).name || lyr.id;
            selectEl.appendChild(opt);
          } else if (layerType === 'map-image' && lyr.visible) {
            const mapImg = lyr as __esri.MapImageLayer;
            mapImg.sublayers?.forEach((sub) => {
              if (sub.visible && 'queryFeatures' in sub) {
                const fl = sub as unknown as __esri.FeatureLayer;
                capasVisiblesCultivo.push(fl);
                const opt = document.createElement('option');
                opt.value = fl.id.toString();
                opt.text =
                  (sub as any).title || (sub as any).name || `${mapImg.title}`;
                selectEl.appendChild(opt);
              }
            });
          }
        });
        buttonCultivoEl.onclick = async () => {
          try {
            await this.analizarSuperposicionCultivo();
          } catch (err) {

          }
        };
        const expandAnalisisCultivo = new Expand({
          view: this.view,
          content: uploadEl7,
          expandTooltip: 'Analizar superposición con poligonos de cultivos',
          expandIcon: 'overwrite-features',
        });
        this.view.ui.add(expandAnalisisCultivo, { position: 'top-right', index: 8 });
        function toggleAnalisisCultivoWidget() {
          if (!expandAnalisisCultivo.container) return;
          if (window.innerWidth < 768) {
            expandAnalisisCultivo.container.style.display = 'none';
            expandAnalisisCultivo.collapse();
          } else {
            expandAnalisisCultivo.container.style.display = 'block';
          }
        }

    // --- Inicio del Tour Guiado ---
    this.tourService.createTourButton(this.view);

    const masterTourSteps: any[] = [
      {
        element: this.view.container,
        title: '¡Bienvenido al Geovisor!',
        content: 'Este es un tour rápido por las principales funcionalidades. Haz clic en "Siguiente" para comenzar.',
        position: 'center'
      },
      {
        element: 'app-buscar', // Cambiado para apuntar al nuevo componente
        title: 'Buscador Inteligente',
        content: 'Utiliza esta barra para buscar polígonos de cultivo por DNI o nombre, oficinas zonales y más.',
        position: 'bottom'
      },
      {
        element: 'app-sidebar',
        title: 'Panel de Capas',
        content: 'Aquí puedes activar o desactivar las diferentes capas de información disponibles en el mapa.',
        position: 'left'
      },
      {
        element: 'arcgis-home',
        title: 'Vista Inicial',
        content: 'Haz clic aquí en cualquier momento para volver a la vista y zoom iniciales del mapa.',
        position: 'left'
      },
      {
        element: 'arcgis-locate',
        title: 'Mi Ubicación',
        content: 'Permite que el navegador acceda a tu ubicación para centrar el mapa en tu posición actual.',
        position: 'left'
      },
      { element: expand.container, widget: expand, title: 'Galería de Mapas Base', content: 'Cambia el mapa de fondo. Puedes elegir entre satelital, calles, topográfico, etc.', position: 'bottom' },
      { element: expanduploadEl.container, widget: expanduploadEl, title: 'Cargar Archivos', content: 'Importa tus propios datos en formato GeoJSON, JSON o CSV para visualizarlos en el mapa.', position: 'left' },
      { element: expandClearGeoJSON.container, widget: expandClearGeoJSON, title: 'Limpiar Capas Cargadas', content: 'Usa este botón para eliminar del mapa todas las capas que hayas importado (GeoJSON, CSV, etc.).', position: 'left' },
      { element: expandAnalisis.container, widget: expandAnalisis, title: 'Análisis de Superposición (SERFOR)', content: 'Analiza si tus polígonos se superponen con la capa de Bosques de Producción Permanente de SERFOR.', position: 'left' },
      { element: expandAnalisisCultivo.container, widget: expandAnalisisCultivo, title: 'Análisis de Superposición (Cultivos)', content: 'Analiza si tus polígonos se superponen con los polígonos de cultivo de PIRDAIS.', position: 'left' },
      {
        element: 'app-info-coordenadas',
        title: 'Información de Coordenadas',
        content: 'Mueve el cursor sobre el mapa para ver las coordenadas geográficas y UTM, y la escala actual.',
        position: 'top'
      },
      {
        element: this.view.container,
        title: 'Fin del Tour',
        content: '¡Has completado el recorrido! Ahora puedes explorar el mapa por tu cuenta.',
        position: 'center'
      }
    ];

    this.tourService.setMasterSteps(masterTourSteps);

    toggleGalleryWidget();
    window.addEventListener('resize', toggleGalleryWidget);
    toggleUploadWidget();
    window.addEventListener('resize', toggleUploadWidget);
    toggleClearGeoJSONWidget();
    window.addEventListener('resize', toggleClearGeoJSONWidget);
    toggleAnalisisWidget();
    window.addEventListener('resize', toggleAnalisisWidget);
    toggleAnalisisCultivoWidget();
    window.addEventListener('resize', toggleAnalisisCultivoWidget);
    //Fin de Widgets

    this.legend = new Legend({
      view: this.view,
      container: document.createElement('div'),
    });

    const ccWidget = new CoordinateConversion({ view: this.view });
    if (this.view) {
      this.view.when(() => {
        this.view!.on('pointer-move', (event) => {
          // Convertir posición de pantalla a mapa
          const point = this.view!.toMap({
            x: event.x,
            y: event.y,
          }) as __esri.Point;

          if (point?.latitude != null && point?.longitude != null) {
            this.updateCoordinates(point.latitude, point.longitude);
          }
        });
      });
    }
    return this.view.when();
  }

  public async searchFeatures(searchTerm: string): Promise<CustomSearchResult[]> {
    if (!this.view || !searchTerm || searchTerm.trim() === '') {
      return [];
    }

    const buscaCapasDEVIDA = [
      {
        layer: new FeatureLayer({
          url: `https://siscod.devida.gob.pe/server/rest/services/DPM_PIRDAIS_CULTIVOS_PRODUCCION/MapServer/1`,
          popupTemplate: popupPoligonoCultivo,
        }),
        searchFields: ['dni_participante', 'nombres'],
        displayField: 'nombres',
        outFields: ['*'],
        name: 'CULTIVOS',
        maxResults: 10,
      },
      {
        layer: new FeatureLayer({
          url: `${this.restCaribSurvey.serviceBase}/${this.restCaribSurvey.capas.recopilacion}`,
          popupTemplate: restCaribRecopilacion,
        }),
        searchFields: ['dni_participante', 'nombre_participante'],
        displayField: 'nombre_participante',
        outFields: ['*'],
        name: 'VISITAS DE MONITOREO',
        maxResults: 10,
      },
      {
        layer: new FeatureLayer({
          url: `${this.restSISCOD}/0`,
          popupTemplate: { title: '{nombre}', content: 'Oficina Zonal' } as any,
        }),
        searchFields: ['nombre'],
        displayField: 'nombre',
        outFields: ['*'],
        name: 'OFICINA ZONAL',
        maxResults: 5,
      },
    ];

    const allResults: CustomSearchResult[] = [];
    const searchPromises: Promise<void>[] = [];

    for (const source of buscaCapasDEVIDA) {
      const whereClause = source.searchFields
        .map(field => {
          if (/^\d+$/.test(searchTerm) && field.toLowerCase().includes('dni')) {
            return `${field} = '${searchTerm}'`;
          }
          return `UPPER(${field}) LIKE '%${searchTerm.toUpperCase()}%'`;
        })
        .join(' OR ');

      const query = source.layer.createQuery();
      query.where = whereClause;
      query.outFields = source.outFields;
      query.returnGeometry = true;
      query.num = source.maxResults;

      const promise = source.layer.queryFeatures(query).then(featureSet => {
        featureSet.features.forEach(feature => {
          const attrs = feature.attributes;
          let secondaryInfo = '';

          if (source.name === 'CULTIVOS' || source.name === 'VISITAS DE MONITOREO') {
            const dni = attrs.dni_participante;
            if (dni) {
              secondaryInfo = `DNI: ${dni}`;
            }
          }
          allResults.push({
            feature: feature,
            layerName: source.name,
            displayValue: attrs[source.displayField],
            secondaryInfo: secondaryInfo,
          });
        });
      }).catch(error => {
        console.error(`Error al buscar en la capa ${source.name}:`, error);
      });
      searchPromises.push(promise);
    }

    await Promise.all(searchPromises);

    return allResults;
  }

  public goToSearchResult(result: CustomSearchResult): void {
    // La geometría puede ser nula, así que debemos protegernos contra eso.
    if (!this.view || !result.feature.geometry) {
      this.showToast('No se puede navegar al resultado porque no tiene geometría.', 'error');
      return;
    }

    // Captura la geometría en una `const`. El análisis de flujo de control de TypeScript
    // puede inferir correctamente que no es nula dentro de la clausura de la promesa.
    const geometry = result.feature.geometry;

    this.view.goTo({
      target: result.feature,
      zoom: 18
    }).then(() => {
      // También es una buena práctica verificar si la vista aún existe antes de usarla.
      if (!this.view) {
        return;
      }
      this.view.openPopup({
        features: [result.feature],
        location: geometry.type === 'point'
            ? (geometry as __esri.Point)
            : (geometry as __esri.Polygon).centroid ?? undefined,
      });

      // Forzar un reflow para arreglar glitches de renderizado en Safari después del zoom/popup.
      // Se usa un setTimeout para asegurar que el DOM se haya actualizado.
      setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    });
  }

  public forceMapResize(): void {
    // Forzar un reflow para arreglar glitches de renderizado en Safari después del zoom/popup.
    // Se usa un setTimeout para asegurar que el DOM se haya actualizado.
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      this.showToast('Mapa reajustado.', 'info');
    }, 150);
  }


  public goToCoordinates(lat: number, lon: number): void {
    if (!this.view) {
      this.showToast('La vista del mapa no está inicializada.', 'error');
      return;
    }

    // Validación básica para Perú
    if (isNaN(lat) || isNaN(lon) || lat > 0 || lat < -20 || lon < -82 || lon > -68) {
      this.showToast('Coordenadas inválidas o fuera del rango para Perú.', 'error');
      return;
    }

    this.coordinateMarkerLayer.removeAll();

    const point = {
      type: 'point',
      longitude: lon, // Usamos la longitud original
      latitude: lat,
      spatialReference: { wkid: 4326 } // WGS 84: El datum de Google Maps/GPS
    };

    const markerSymbol = new SimpleMarkerSymbol({
      color: [37, 99, 235], // Azul
      outline: {
        color: [255, 255, 255], // Blanco
        width: 2,
      },
      size: '12px'
    });

    const pointGraphic = new Graphic({
      geometry: point as any,
      symbol: markerSymbol,
      popupTemplate: new PopupTemplate({
        title: 'Ubicación por Coordenada',
        content: `<b>Latitud:</b> {latitude}<br><b>Longitud:</b> {longitude}`,
      }),
      attributes: {
        latitude: lat,
        longitude: lon,
      },
    });

    this.coordinateMarkerLayer.add(pointGraphic);

    this.view.goTo({
      target: pointGraphic,
      zoom: 16, // Un buen nivel de zoom para ver detalles
    }).then(() => {
      this.view?.openPopup({ features: [pointGraphic] });
    });
  }

  public goToUTMCoordinates(este: number, norte: number, zona: '17S' | '18S' | '19S'): void {
    // Definiciones de Proj4 para las zonas UTM de Perú (WGS84)
    const utmDefs: Record<string, string> = {
      '17S': '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs',
      '18S': '+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs',
      '19S': '+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs',
    };
    const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';

    try {
      // Realizar la conversión de UTM a Geográficas (Longitud, Latitud)
      const [lon, lat] = proj4(utmDefs[zona], wgs84, [este, norte]);

      // Reutilizar la función existente para ir a las coordenadas
      this.goToCoordinates(lat, lon);

    } catch (error) {
      this.showToast('Error al convertir las coordenadas UTM.', 'error');
    }
  }

  public clearCoordinateMarker(): void {
    if (this.view) {
      // Cierra cualquier popup que esté abierto
      this.view.closePopup();
    }
    // Elimina los gráficos de la capa de marcadores
    this.coordinateMarkerLayer.removeAll();
  }

  public async getOficinasZonales(forceRefresh = false): Promise<{ nombre: string }[]> {
    // Si tenemos datos en caché y no se fuerza la actualización, los devolvemos directamente.
    if (this._oficinasZonalesCache && !forceRefresh) {
      return this._oficinasZonalesCache;
    }

    const layerUrl = `${this.restSISCOD}/0`;
    const layer = new FeatureLayer({ url: layerUrl });

    try {
      const query = layer.createQuery();
      query.where = "1=1";
      query.outFields = ["nombre"];
      query.returnGeometry = false;
      query.orderByFields = ["nombre"];
      // Pedimos todos los resultados para evitar paginación en una lista que debería ser corta.
      query.num = 200;

      const featureSet = await layer.queryFeatures(query);

      const nombresUnicos = new Set(featureSet.features.map(f => f.attributes.nombre));
      const resultado = Array.from(nombresUnicos).sort().map(nombre => ({ nombre }));

      // Guardamos el resultado en caché para futuras llamadas.
      this._oficinasZonalesCache = resultado;
      return resultado;

    } catch (error) {
      this.showToast("No se pudieron cargar las oficinas zonales.", "error");
      return [];
    }
  }

  public async zoomToOficinaZonal(nombreOficina: string): Promise<void> {
    if (!this.view) {
      this.showToast("El mapa no está listo.", "error");
      return;
    }

    // Si es la primera búsqueda desde una limpieza, guardar el estado de las capas y apagarlas
    if (this.previousLayerVisibility.size === 0) {
      this.mapa.layers.forEach(layer => {
        const esCapaEsencial =
          layer.title === 'POLIGONOS DE CULTIVO' ||
          layer.id === this.highlightLayer.id ||
          layer.id === this.coordinateMarkerLayer.id;

        if (!esCapaEsencial) {
          this.previousLayerVisibility.set(layer.id, layer.visible);
          if (layer.visible) {
            layer.visible = false;
          }
        }
      });
    }

    const layer = this.mapa.layers.find(lyr => lyr.title === 'OFICINAS ZONALES') as __esri.MapImageLayer;
    if (!layer) {
      this.showToast("La capa 'Oficinas Zonales' no está en el mapa.", "error");
      return;
    }

    const sublayer = layer.sublayers?.find(sl => sl.id === 0);
    if (!sublayer || !('queryFeatures' in sublayer)) {
      this.showToast("No se encontró la subcapa de Oficinas Zonales.", "error");
      return;
    }

    this.highlightLayer.removeAll(); // Limpiar resaltado anterior

    try {
      const featureSet = await sublayer.queryFeatures({
        where: `nombre = '${nombreOficina}'`,
        outFields: ["*"],
        returnGeometry: true,
      });

      if (featureSet.features.length > 0) {
        const feature = featureSet.features[0];
        const highlightGraphic = new Graphic({
          geometry: feature.geometry,
          symbol: { type: "simple-fill", color: [255, 255, 0, 0.4], outline: { color: [255, 255, 0, 1], width: 2 } } as any
        });
        this.highlightLayer.add(highlightGraphic);
        this.view.goTo(feature.geometry);
      } else {
        this.showToast(`No se encontró la oficina zonal: ${nombreOficina}`, "info");
      }
    } catch (error) {
      this.showToast("Ocurrió un error al buscar la oficina.", "error");
    }
  }

  public async getStatsForOficina(nombreOficina: string): Promise<OficinaStats> {
    const layer = new FeatureLayer({ url: `${this.restSISCOD}/1` });

    // NOTA: El dashboard realiza el filtrado por oficina zonal en el cliente, no en el servidor.
    // Aunque es ineficiente porque trae todos los datos, replicamos ese patrón para asegurar consistencia,
    // ya que podría haber un problema con el servicio al filtrar por 'oficina_zonal' en el 'where'.
    const baseWhere = `1=1`;

    try {
      // 1. Obtener TODOS los registros de polígonos.
      const allFeatures: __esri.Graphic[] = [];
      let offset = 0;
      const pageSize = 2000;
      let hasMore = true;

      while (hasMore) {
        const query = layer.createQuery();
        query.where = baseWhere;
        query.outFields = ["oficina_zonal", "area_cultivo", "tipo_cultivo", "dni_participante"];
        query.returnGeometry = false;
        query.start = offset;
        query.num = pageSize;

        const featureSet = await layer.queryFeatures(query);
        const features = featureSet.features;

        if (features.length > 0) {
          allFeatures.push(...features);
          offset += features.length;
          hasMore = features.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // 2. Filtrar los registros por la oficina zonal seleccionada en el cliente.
      const officeFeatures = allFeatures.filter(f =>
        (f.attributes.oficina_zonal || '').replace(/^OZ\s+/, '').trim().toUpperCase() === nombreOficina.trim().toUpperCase()
      );

      if (officeFeatures.length === 0) {
        // Esto puede pasar si no hay polígonos para esa oficina.
        return { totalHectareas: 0, hectareasCacao: 0, hectareasCafe: 0, totalFamilias: 0, familiasCacao: 0, familiasCafe: 0, familiasAmbos: 0 };
      }

      // 3. Calcular las estadísticas sobre los datos ya filtrados.
      let totalHectareas = 0;
      let hectareasCacao = 0;
      let hectareasCafe = 0;
      const dnisCafe = new Set<string>();
      const dnisCacao = new Set<string>();
      const dnisTotal = new Set<string>();

      officeFeatures.forEach(feature => {
        const attrs = feature.attributes;
        const area = attrs.area_cultivo || 0;
        const dni = attrs.dni_participante;
        const cultivoRaw = (attrs.tipo_cultivo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        // Suma de hectáreas
        totalHectareas += area;
        if (cultivoRaw.includes('cacao')) {
          hectareasCacao += area;
        }
        if (cultivoRaw.includes('cafe')) {
          hectareasCafe += area;
        }

        // Conteo de familias (DNIs únicos)
        if (dni) {
          dnisTotal.add(dni);
          if (cultivoRaw.includes('cacao')) dnisCacao.add(dni);
          if (cultivoRaw.includes('cafe')) dnisCafe.add(dni);
        }
      });

      const dnisAmbos = [...dnisCacao].filter(dni => dnisCafe.has(dni));

      return {
        totalHectareas,
        hectareasCacao,
        hectareasCafe,
        totalFamilias: dnisTotal.size,
        familiasCacao: dnisCacao.size,
        familiasCafe: dnisCafe.size,
        familiasAmbos: dnisAmbos.length
      };

    } catch (error) {
        this.showToast('Error al calcular las estadísticas de la oficina.', 'error');
        return { totalHectareas: 0, hectareasCacao: 0, hectareasCafe: 0, totalFamilias: 0, familiasCacao: 0, familiasCafe: 0, familiasAmbos: 0 };
    }
  }

  public clearHighlights(): void {
    this.highlightLayer.removeAll();
    if (this.view) this.view.closePopup();

    // Restaurar visibilidad de las capas
    this.previousLayerVisibility.forEach((isVisible, layerId) => {
      const layerToRestore = this.mapa.findLayerById(layerId);
      if (layerToRestore) {
        layerToRestore.visible = isVisible;
      }
    });
    this.previousLayerVisibility.clear();
  }

    destroyMap(): void {
      // Es crucial remover los watchers para evitar que se ejecuten sobre una vista destruida.
      if (this.scaleWatcher) {
        this.scaleWatcher.remove();
        this.scaleWatcher = null;
      }

      if (this.view) {
        // view.destroy() es el método oficial para limpiar completamente la vista
        // y todos sus recursos asociados (widgets, listeners, watchers, etc.).
        // Esto previene fugas de memoria y errores como el que experimentas.
        this.view.destroy();
        this.view = null;
      }
    }

    public resetMapState(): void {
      this.destroyMap();
      if (this.mapa) {
        this.mapa.destroy();
      }
      // Se vuelve a crear el mapa base.
      this.mapa = new EsriMap({ basemap: 'satellite' });

      // Es CRUCIAL volver a crear estas capas, ya que se destruyen junto con el mapa anterior.
      // Si no se recrean, se intentará añadir capas destruidas al nuevo mapa, causando errores.
      this.highlightLayer = new GraphicsLayer({ id: 'highlight-overlaps' });
      this.coordinateMarkerLayer = new GraphicsLayer({ id: 'coordinate-marker' });

      this.mapa.add(this.highlightLayer);
      this.mapa.add(this.coordinateMarkerLayer);
    }
    //Inicio del Toogle
    toggleLayerVisibility(layerTitle: string, visibility: boolean): void {
      const layer = this.mapa.layers.find((layer) => layer.title === layerTitle);
      if (layer) {
        layer.visible = visibility;
      }
    }
    getLayerVisibility(layerTitle: string): boolean {
      const layer = this.mapa.layers.find((layer) => layer.title === layerTitle);
      return layer ? layer.visible : false;
    }
    private capas: Record<string, FeatureLayer> = {};
    getActiveLayers(): FeatureLayer[] {
      return Object.values(this.capas).filter((layer) => layer.visible);
    }
    //Coordenadas
    async updateCoordinates(lat: number, lon: number): Promise<void> {
      this.gcsLatitude = lat.toFixed(5);
      this.gcsLongitude = lon.toFixed(5);
      // Calculate UTM Zone
      const zoneNumber = Math.floor((lon + 180) / 6) + 1;
      const utmBand = this.getUtmBand(lat);
      this.utmZone = `${zoneNumber} ${utmBand}`;
      const utm = latLonToUTM(lat, lon);
      this.utmZone = `${utm.zoneNumber} ${utm.zoneLetter}`;
      this.utmEast = `${utm.easting.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} m`;
      this.utmNorth = `${utm.northing.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} m`;
      function latLonToUTM(lat: number, lon: number) {
        const a = 6378137.0;
        const f = 1 / 298.257223563;
        const k0 = 0.9996;
        const zoneNumber = Math.floor((lon + 180) / 6) + 1;
        const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;
        const lonOriginRad = (lonOrigin * Math.PI) / 180;
        const latRad = (lat * Math.PI) / 180;
        const lonRad = (lon * Math.PI) / 180;
        const e = Math.sqrt(f * (2 - f));
        const N = a / Math.sqrt(1 - Math.pow(e * Math.sin(latRad), 2));
        const T = Math.tan(latRad) ** 2;
        const C = ((e * e) / (1 - e * e)) * Math.cos(latRad) ** 2;
        const A = Math.cos(latRad) * (lonRad - lonOriginRad);
        const M =
          a *
          ((1 - (e * e) / 4 - (3 * e ** 4) / 64 - (5 * e ** 6) / 256) * latRad -
            ((3 * e * e) / 8 + (3 * e ** 4) / 32 + (45 * e ** 6) / 1024) *
            Math.sin(2 * latRad) +
            ((15 * e ** 4) / 256 + (45 * e ** 6) / 1024) * Math.sin(4 * latRad) -
            ((35 * e ** 6) / 3072) * Math.sin(6 * latRad));
        const easting =
          k0 *
          N *
          (A +
            ((1 - T + C) * A ** 3) / 6 +
            ((5 - 18 * T + T ** 2 + 72 * C - 58 * ((e * e) / (1 - e * e))) *
              A ** 5) /
            120) +
          500000;
        let northing =
          k0 *
          (M +
            N *
            Math.tan(latRad) *
            (A ** 2 / 2 +
              ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
              ((61 -
                58 * T +
                T ** 2 +
                600 * C -
                330 * ((e * e) / (1 - e * e))) *
                A ** 6) /
              720));
        if (lat < 0) northing += 10000000;
        const bands = 'CDEFGHJKLMNPQRSTUVWX';
        const index = Math.floor((lat + 80) / 8);
        const zoneLetter = bands.charAt(index);
        return { easting, northing, zoneNumber, zoneLetter };
      }
    }
    getUtmBand(latitude: number): string {
      const bands = 'CDEFGHJKLMNPQRSTUVWX'; // Bands from 80S to 84N
      const index = Math.floor((latitude + 80) / 8);
      return bands.charAt(index);
    }
    formatScale(scale: number): string {
      return scale.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    }
    //Funcion que importa un archivo GeoJson
    async dataImport(
      file: File,
      coordType?: 'UTM' | 'GEOGRAFICA'
    ): Promise<void> {
      if (!file || !this.view || !this.mapa) return;
      const fileName = file.name.toLowerCase();
      if (
        !fileName.endsWith('.json') &&
        !fileName.endsWith('.geojson') &&
        !fileName.endsWith('.csv')
      ) {
        await this.showModal(
          'Formato no soportado. Solo se permiten archivos .json, .geojson o .csv',
          '⚠️ Error'
        );
        return;
      }
      const utmDefs: Record<string, string> = {
        '17S': '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs',
        '18S': '+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs',
        '19S': '+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs',
      };
      const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';
      // 👉 reemplazo de prompt por select (tipo coordenadas)
      if (!coordType) {
        coordType = await this.showSelect<'UTM' | 'GEOGRAFICA'>(
          'Seleccione el tipo de coordenadas:',
          [
            { value: 'UTM', label: 'UTM' },
            { value: 'GEOGRAFICA', label: 'GEOGRÁFICA' },
          ]
        );
        if (!coordType) return;
      }
      // 👉 si eligió UTM, pedimos zona con otro select
      let utmZone: '17S' | '18S' | '19S' | undefined;
      if (coordType === 'UTM') {
        utmZone = await this.showSelect<'17S' | '18S' | '19S'>(
          'Seleccione la zona UTM:',
          [
            { value: '17S', label: '17S' },
            { value: '18S', label: '18S' },
            { value: '19S', label: '19S' },
          ]
        );
        if (!utmZone) return;
      }
      function reproyectarCoord(coord: number[]): number[] {
        if (!utmZone) return coord;
        return proj4(utmDefs[utmZone!], wgs84, coord);
      }
      function reproyectarGeoJSONGeometry(geom: any): any {
        if (!geom) return geom;
        const mapCoord = (c: number[]) => reproyectarCoord(c);
        switch (geom.type) {
          case 'Point':
            return { type: 'Point', coordinates: mapCoord(geom.coordinates) };
          case 'LineString':
          case 'MultiPoint':
            return {
              type: geom.type,
              coordinates: geom.coordinates.map(mapCoord),
            };
          case 'Polygon':
          case 'MultiLineString':
            return {
              type: geom.type,
              coordinates: geom.coordinates.map((ring: any) =>
                ring.map(mapCoord)
              ),
            };
          case 'MultiPolygon':
            return {
              type: 'MultiPolygon',
              coordinates: geom.coordinates.map((poly: any) =>
                poly.map((ring: any) => ring.map(mapCoord))
              ),
            };
          default:
            return geom;
        }
      }
      try {
        let geojson: any;
        let layer: __esri.Layer | null = null;

        if (fileName.endsWith('.csv')) {
          const blobUrl = URL.createObjectURL(file);
          layer = new CSVLayer({ url: blobUrl, title: file.name });
        } else {
          const text = await file.text();
          geojson = JSON.parse(text);
        }
        if (!layer && geojson) {
          const validFeatures =
            geojson.features?.filter((f: any) => f.geometry) || [];
          if (validFeatures.length === 0) {
            await this.showModal(
              'El archivo no contiene geometrías válidas para mostrar en el mapa.',
              '⚠️ Error'
            );
            return;
          }
          // --- contar polígonos ---
          const polygonCount = validFeatures.filter(
            (f: any) =>
              f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
          ).length;
          const featuresProcesadas = validFeatures.map((f: any) => ({
            ...f,
            geometry: reproyectarGeoJSONGeometry(f.geometry),
          }));
          const blob = new Blob(
            [
              JSON.stringify({
                type: 'FeatureCollection',
                features: featuresProcesadas,
              }),
            ],
            { type: 'application/json' }
          );
          const blobUrl = URL.createObjectURL(blob);
          const sampleGeom = featuresProcesadas[0].geometry;
          let renderer: any;
          if (!sampleGeom) {
            renderer = undefined;
          } else if (
            sampleGeom.type === 'Point' ||
            sampleGeom.type === 'MultiPoint'
          ) {
            renderer = {
              type: 'simple',
              symbol: {
                type: 'simple-marker',
                color: [0, 128, 255, 0.8],
                size: 8,
                outline: { color: [0, 0, 0, 0.8], width: 1 },
              },
            };
          } else if (
            sampleGeom.type === 'LineString' ||
            sampleGeom.type === 'MultiLineString'
          ) {
            renderer = {
              type: 'simple',
              symbol: {
                type: 'simple-line',
                color: [0, 255, 0, 0.8],
                width: 2,
              },
            };
          } else if (
            sampleGeom.type === 'Polygon' ||
            sampleGeom.type === 'MultiPolygon'
          ) {
            renderer = {
              type: 'simple',
              symbol: {
                type: 'simple-fill',
                color: [0, 0, 255, 0.3],
                outline: { color: [255, 0, 0, 1], width: 1 },
              },
            };
          }
          layer = new GeoJSONLayer({ url: blobUrl, title: file.name, renderer });
          // --- mostrar cantidad de polígonos ---
          if (polygonCount > 0) {
            await this.showModal(
              `Se importaron ${polygonCount} polígonos.`,
              '✅ Importación exitosa'
            );
          }
        }
        if (!layer) return;
        this.mapa.add(layer);
        layer
          .when(() => {
            if (layer!.fullExtent && this.view) {
              this.view
                .goTo(layer!.fullExtent)
                .catch((err) =>
                  console.warn('No se pudo hacer zoom a la capa:', err)
                );
            }
            this.showModal(
              `Capa "${file.name}" cargada correctamente.`,
              '✅ Éxito'
            );
          })
          .catch((err) => {
            console.error('Error cargando la capa:', err);
            this.showModal(
              'Ocurrió un error cargando la capa. Revisa la consola.',
              '⚠️ Error'
            );
          });
      } catch (err) {
        console.error('Error procesando el archivo:', err);
        this.showModal(
          'Ocurrió un error procesando el archivo. Revisa la consola.',
          '⚠️ Error'
        );
      }
    }
    //Funcion que limpia el mapa de los archivos GeoJson
    public clearGeoJSONLayers(): void {
      const layersToRemove: __esri.Layer[] = [];
      this.mapa.layers.forEach(layer => {
        if (layer.type === 'geojson' || layer.type === 'csv') {
          layersToRemove.push(layer);
        }
      });
      if (layersToRemove.length > 0) {
        this.mapa.removeMany(layersToRemove);
        this.showToast(`Se eliminaron ${layersToRemove.length} capas GeoJSON/CSV.`, 'success');
      } else {
        this.showToast('No hay capas GeoJSON/CSV para eliminar.', 'info');
      }
    }

    private showModal(
      message: string,
      typeOrTitle?: 'success' | 'error' | 'info' | string,
      title?: string
    ): Promise<void> {
      return new Promise<void>((resolve) => {
        // mapa de iconos y títulos por defecto
        const icons: Record<'success' | 'error' | 'info', string> = {
          success: '✅',
          error: '⚠️',
          info: 'ℹ️',
        };
        const defaultTitles: Record<'success' | 'error' | 'info', string> = {
          success: 'Éxito',
          error: 'Error',
          info: 'Aviso',
        };
        // determinar type y título final según lo que se pase
        let type: 'success' | 'error' | 'info' = 'info';
        let finalTitle: string | undefined = title;
        if (typeof typeOrTitle === 'string') {
          // si es exactamente uno de los tipos
          if (
            typeOrTitle === 'success' ||
            typeOrTitle === 'error' ||
            typeOrTitle === 'info'
          ) {
            type = typeOrTitle;
          } else if (typeOrTitle.includes('✅')) {
            type = 'success';
            finalTitle = typeOrTitle;
          } else if (typeOrTitle.includes('⚠️')) {
            type = 'error';
            finalTitle = typeOrTitle;
          } else if (typeOrTitle.includes('ℹ️')) {
            type = 'info';
            finalTitle = typeOrTitle;
          } else {
            // si no contiene emoji ni es literal tipo, lo tratamos como título personalizado
            finalTitle = typeOrTitle;
          }
        }
        const icon = icons[type];
        const header = finalTitle || defaultTitles[type];
        const wrapper = document.createElement('div');
        wrapper.className =
          'modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
        wrapper.innerHTML = `
          <div class="bg-white rounded-lg shadow-lg p-6 w-96">
            <div class="flex items-center mb-4">
              <span class="text-2xl mr-3">${icon}</span>
              <h2 class="text-lg font-bold">${header}</h2>
            </div>
            <p class="mb-4">${message}</p>
            <div class="flex justify-end">
              <button id="modalOk" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Aceptar</button>
            </div>
          </div>
        `;
        document.body.appendChild(wrapper);
        const btn = wrapper.querySelector<HTMLButtonElement>('#modalOk')!;
        btn.onclick = () => {
          wrapper.remove();
          resolve();
        };
        // opcional: cerrar con ESC
        const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            wrapper.remove();
            window.removeEventListener('keydown', onKey);
            resolve();
          }
        };
        window.addEventListener('keydown', onKey);
      });
    }
    private showSelect<T extends string>(
      label: string,
      options: { value: T; label: string }[]
    ): Promise<T | undefined> {
      return new Promise<T | undefined>((resolve) => {
        const wrapper = document.createElement('div');
        wrapper.className =
          'modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
        wrapper.innerHTML = `
          <div class="bg-white rounded-lg shadow-lg p-6 w-96">
            <div class="flex items-center mb-4">
              <span class="text-2xl mr-2">📌</span>
              <h2 class="text-lg font-bold">Seleccione una opción</h2>
            </div>
            <p class="mb-2">${label}</p>
            <select id="modalSelect" class="p-2 border rounded w-full mb-4">
              <option value="">-- Seleccione --</option>
              ${options
            .map((o) => `<option value="${o.value}">${o.label}</option>`)
            .join('')}
            </select>
            <button id="modalOk" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Aceptar</button>
          </div>
        `;
        document.body.appendChild(wrapper);
        const select = wrapper.querySelector<HTMLSelectElement>('#modalSelect')!;
        const btn = wrapper.querySelector<HTMLButtonElement>('#modalOk')!;
        btn.onclick = () => {
          const value = select.value as T;
          wrapper.remove();
          resolve(value || undefined);
        };
      });
    }
    //Funcion que analiza la superposicion de una capa con la capa BPP(SERFOR)
    async analizarSuperposicionSERFOR(): Promise<void> {
      if (!this.view || !this.mapa) return;
      this.highlightLayer.removeAll();

      let overlay = document.getElementById("loading-overlay") as HTMLDivElement | null;
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loading-overlay";
        Object.assign(overlay.style, {
          position: "absolute",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.3)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: "9999",
          color: "#fff",
          fontSize: "1.2rem",
        });
        const spinner = document.createElement("div");
        spinner.className = "animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white";
        const text = document.createElement("div");
        text.id = "progress-text";
        text.textContent = "Analizando superposición, por favor espere...";
        text.style.marginLeft = "10px";
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.appendChild(spinner);
        container.appendChild(text);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
      }
      overlay.style.display = "flex";

      const progressText = document.getElementById("progress-text")!;
      let overlaps: __esri.Graphic[] = [];
      let intersectedFeaturesB: __esri.Graphic[] = []; // <-- Array de polígonos intersectados
      let capaBTitle = "la capa seleccionada";

      try {
        // --- Cargar capa SERFOR ---
        progressText.textContent = "🔹Cargando la capa Bosque Proteccion Permanente (SERFOR)...!";
        const capaSerfor = new FeatureLayer({
          url: "https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/Ordenamiento_Forestal/MapServer/1",
        });
        await capaSerfor.load();

        const featuresA: __esri.Graphic[] = [];
        const num = 2000;
        for (let startA = 0; ; startA += num) {
          const res = await capaSerfor.queryFeatures({
            where: "1=1",
            outFields: ["*"],
            returnGeometry: true,
            start: startA,
            num,

          });
          featuresA.push(...res.features);
          if (res.features.length < num) break;
        }

        const validGeometriesA = featuresA
          .map(f => f.geometry)
          .filter((g): g is __esri.Polygon => !!g && ["polygon", "multipolygon"].includes(g.type.toLowerCase()));

        if (!validGeometriesA.length) {
          this.showToast("⚠️ No hay geometrías válidas en BPP-SERFOR.", "error");
          overlay.style.display = "none";
          return;
        }

        const geomA = await geometryEngineAsync.union(validGeometriesA) as __esri.GeometryUnion;
        if (!geomA) {
          this.showToast("⚠️ No se pudieron unir las geometrías de SERFOR.", "error");
          overlay.style.display = "none";
          return;
        }

        // --- Obtener capa seleccionada ---
        const selectEl = document.querySelector<HTMLSelectElement>(".file-upload-widget select");
        if (!selectEl) { overlay.style.display = "none"; return; }
        const selectedId = selectEl.value;
        if (!selectedId) {
          this.showToast("⚠️ Selecciona una capa para analizar.", "error");
          overlay.style.display = "none";
          return;
        }

        let capaB: __esri.Layer | undefined = this.mapa.layers.find(l => l.id === selectedId);
        if (!capaB) {
          for (const l of this.mapa.layers.toArray()) {
            if (l.type === "map-image") {
              const mapImg = l as __esri.MapImageLayer;
              const sub = mapImg.sublayers?.find(s => s.id.toString() === selectedId);
              if (sub) { capaB = sub as unknown as __esri.Layer; break; }
            }
          }
        }
        if (!capaB) {
          this.showToast("⚠️ No se encontró la capa seleccionada en el mapa.", "error");
          overlay.style.display = "none";
          return;
        }
        capaBTitle = capaB.title || capaB.id;
        progressText.textContent = `⏳ Analizando superposición con la capa: ${capaBTitle}`;
        await capaB.load?.();


        let featuresB: __esri.Graphic[] = [];
        if ("queryFeatures" in capaB) {
          for (let startB = 0; ; startB += num) {
            const resB = await (capaB as __esri.FeatureLayer).queryFeatures({
              where: "1=1",
              outFields: ["*"],
              returnGeometry: true,
              start: startB,
              num: num
            });
            featuresB.push(...resB.features);
            if (resB.features.length < num) break;
          }
        } else if ("source" in capaB) {
          featuresB = ((capaB as any).source as __esri.Collection<__esri.Graphic>).toArray();
        }

        if (!featuresB.length) {
          this.showToast("⚠️ La capa seleccionada no contiene geometrías.", "error");
          overlay.style.display = "none";
          return;
        }

        const blockSize = 25;
        overlaps = [];
        intersectedFeaturesB = [];
        for (let i = 0; i < featuresB.length; i += blockSize) {
          const block = featuresB.slice(i, i + blockSize);
          const promises = block.map(fB => (async () => {
            if (!fB.geometry || !["polygon", "multipolygon"].includes(fB.geometry.type.toLowerCase())) return null;
            const intersecta = await geometryEngineAsync.intersects(fB.geometry as __esri.GeometryUnion, geomA);
            if (intersecta) {
              intersectedFeaturesB.push(fB); // <-- guardamos la feature de B
              return new Graphic({
                geometry: fB.geometry,
                attributes: { capaA: "Ordenamiento Forestal", capaB: capaB.title || capaB.id, ...fB.attributes },
                symbol: { type: "simple-fill", color: [255, 0, 0, 0.4], outline: { color: [255, 0, 0], width: 2 } } as any,
                popupTemplate: {
                  title: "Superposición detectada",
                  content: `Polígono de <b>${capaB.title || capaB.id}</b> se superpone con <b>Bosque de produccion permanente</b>.`
                }
              });
            }
            return null;
          })());
          const results = await Promise.all(promises);
          overlaps.push(...results.filter(r => r !== null) as __esri.Graphic[]);
          progressText.innerHTML = `Procesadas ${Math.min(i + blockSize, featuresB.length)} de ${featuresB.length} features<br>Superposiciones detectadas: ${overlaps.length}`;
          await new Promise(r => setTimeout(r, 0));
        }

        this.highlightLayer.addMany(overlaps);

      } catch (error) {
        console.error("Error analizando superposiciones:", error);
        this.showToast("❌ Ocurrió un error al analizar superposiciones.", "error");
      } finally {
        const overlapsCount = overlaps.length;

        // 🔹 Ocultar overlay
        if (overlay) overlay.style.display = "none";

        // 🔹 Modal interactivo con exportación CSV
        const modal = document.createElement("div");
        modal.id = "resultado-modal";
        Object.assign(modal.style, {
          position: "fixed",
          top: "0", left: "0",
          width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: "10001",
        });

        const csvButton = intersectedFeaturesB.length > 0
          ? `<button id="export-csv"
              style="
                margin-top:10px;
                padding:6px 12px;
                background-color:#16A34A;
                color:white;
                border:none;
                border-radius:6px;
                font-weight:bold;
                cursor:pointer;
                transition: background-color 0.3s;
              "
              onmouseover="this.style.backgroundColor='#15803D'"
              onmouseout="this.style.backgroundColor='#16A34A'">
              Exportar CSV
            </button>`
          : '';

        modal.innerHTML = `
          <div style="background:white;padding:20px;border-radius:8px;max-width:450px;text-align:center;">
            <h2>Resultado del análisis</h2>
            <p>${overlapsCount > 0 ? `Se encontraron ${overlapsCount} superposiciones en ${capaBTitle}.` : `No se encontraron superposiciones.`}</p>
            ${csvButton}
            <button id="modal-close"
                style="
                  margin-top:10px;
                  padding:6px 12px;
                  background-color:#2563EB;
                  color:white;
                  border:none;
                  border-radius:6px;
                  font-weight:bold;
                  cursor:pointer;
                  transition: background-color 0.3s;
                "
                onmouseover="this.style.backgroundColor='#1D4ED8'"
                onmouseout="this.style.backgroundColor='#2563EB'">
                Cerrar
            </button>
          </div>
        `;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector<HTMLButtonElement>("#modal-close");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            modal.remove();
            this.highlightLayer.removeAll();
          });
        }

        const exportBtn = modal.querySelector<HTMLButtonElement>("#export-csv");
        if (exportBtn) {
          exportBtn.addEventListener("click", () => {
            if (!intersectedFeaturesB.length) return;

            const keys = Object.keys(intersectedFeaturesB[0].attributes);
            const csvContent = [
              keys.join(","), // encabezado
              ...intersectedFeaturesB.map(f =>
                keys.map(k => `"${(f.attributes[k] ?? '').toString().replace(/"/g, '""')}"`).join(",")
              )
            ].join("\n");

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `superposiciones_${capaBTitle}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          });
        }

        // 🔹 Toast resumen
        const toastMessage = overlapsCount > 0
          ? `✅ Se encontraron ${overlapsCount} superposiciones en ${capaBTitle}.`
          : `✅ No se encontraron superposiciones en la capa seleccionada.`;
        this.showToast(toastMessage, "success", false);
      }
    }
    //Funcion para analizar la superposicion en la capa Cultivo
    async analizarSuperposicionCultivo(): Promise<void> {

      if (!this.view || !this.mapa) {
        return;
      }
      this.highlightLayer.removeAll();
      // --- Overlay ---
      let overlay = document.getElementById("loading-overlay-cultivo") as HTMLDivElement | null;
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loading-overlay-cultivo";
        Object.assign(overlay.style, {
          position: "absolute",
          top: "0", left: "0",
          width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.3)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: "9999",
          color: "#fff",
          fontSize: "1.2rem",
        });
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.alignItems = "center";
        const spinner = document.createElement("div");
        spinner.className = "animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white";
        const text = document.createElement("div");
        text.id = "progress-text-cultivo";
        text.textContent = "Analizando superposición de Cultivo...";
        text.style.marginLeft = "10px";
        container.appendChild(spinner);
        container.appendChild(text);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
      }
      overlay.style.display = "flex";
      const progressText = document.getElementById("progress-text-cultivo")!;

      let overlaps: __esri.Graphic[] = [];
      let intersectados: __esri.Graphic[] = [];
      let capaBSelTitle = "capa seleccionada";

      try {
        const capaDevida = new FeatureLayer({
          url: "https://siscod.devida.gob.pe/server/rest/services/DPM_PIRDAIS_CULTIVOS_PRODUCCION/MapServer/1"
        });
        await capaDevida.load();

        // --- Capa seleccionada ---
        const selectEl = document.querySelector<HTMLSelectElement>("#analisis-cultivo-widget select");
        if (!selectEl?.value) {
          this.showToast("⚠️ Selecciona una capa para analizar.", "error");
          overlay.style.display = "none";
          return;
        }

        let capaBSel: __esri.Layer | undefined = this.mapa.layers.find(l => l.id === selectEl.value);
        if (!capaBSel) {
          for (const l of this.mapa.layers.toArray()) {
            if (l.type === "map-image") {
              const sub = (l as __esri.MapImageLayer).sublayers?.find(s => s.id.toString() === selectEl.value);
              if (sub) { capaBSel = sub as unknown as __esri.Layer; break; }
            }
          }
        }
        if (!capaBSel) {
          this.showToast("⚠️ No se encontró la capa seleccionada.", "error");
          overlay.style.display = "none";
          return;
        }
        capaBSelTitle = capaBSel.title || capaBSel.id;
        await capaBSel.load?.();

        // --- Obtener features de la capa seleccionada ---
        let featuresB: __esri.Graphic[] = [];
        if ("queryFeatures" in capaBSel) {
          const res = await (capaBSel as __esri.FeatureLayer).queryFeatures({
            where: "1=1",
            outFields: ["*"],
            returnGeometry: true
          });
          featuresB = res.features;
        } else if ("source" in capaBSel) {
          featuresB = ((capaBSel as any).source as __esri.Collection<__esri.Graphic>).toArray();
        }

        if (!featuresB.length) {
          this.showToast("⚠️ La capa seleccionada no tiene geometrías.", "error");
          overlay.style.display = "none";
          return;
        }

        // --- Analizar superposición polígono por polígono ---
        const tamBloque = 25;
        overlaps = [];
        intersectados = [];

        for (let i = 0; i < featuresB.length; i += tamBloque) {
          const block = featuresB.slice(i, i + tamBloque);
          const promises = block.map(async (fB) => {
            if (!fB.geometry || !["polygon", "multipolygon"].includes(fB.geometry.type.toLowerCase())) return null;

            const res = await capaDevida.queryFeatures({
              geometry: fB.geometry,
              spatialRelationship: "intersects",
              returnGeometry: false,
              outFields: ["*"]
            });

            if (res.features.length > 0) {
              intersectados.push(fB);
              return new Graphic({
                geometry: fB.geometry,
                attributes: { ...fB.attributes, capa: capaBSelTitle },
                symbol: {
                  type: "simple-fill",
                  color: [0, 150, 255, 0.4],
                  outline: { color: [255, 0, 0], width: 2 }
                } as any,
                popupTemplate: {
                  title: "Superposición detectada",
                  content: `Polígono de <b>${capaBSelTitle}</b> se superpone con DAIS.`
                }
              });
            }
            return null;
          });

          const results = await Promise.all(promises);
          overlaps.push(...results.filter(r => r !== null) as __esri.Graphic[]);
          progressText.innerHTML = `Procesadas ${Math.min(i + tamBloque, featuresB.length)} de ${featuresB.length} features<br>Superposiciones: ${overlaps.length}`;
          await new Promise(r => setTimeout(r, 0));
        }

        this.highlightLayer.addMany(overlaps);

      } catch (err) {
        console.error("💥 Error en analizarSuperposicionCultivo:", err);
        this.showToast("❌ Error en análisis de superposición.", "error");
      } finally {
        overlay.style.display = "none";
        const overlapsCount = overlaps.length;

        // 🔹 Modal interactivo con exportación CSV
        const modal = document.createElement("div");
        modal.id = "resultado-modal-cultivo";
        Object.assign(modal.style, {
          position: "fixed",
          top: "0", left: "0",
          width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: "10001",
        });

        const csvButton = intersectados.length > 0
          ? `<button id="export-csv-cultivo"
                      style="margin-top:10px;padding:6px 12px;background-color:#16A34A;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
                      Exportar CSV
                    </button>`
          : '';

        modal.innerHTML = `
                  <div style="background:white;padding:20px;border-radius:8px;max-width:450px;text-align:center;">
                    <h2>Resultado del análisis</h2>
                    <p>${overlapsCount > 0 ? `Se encontraron ${overlapsCount} superposiciones en ${capaBSelTitle}.` : `No se encontraron superposiciones.`}</p>
                    ${csvButton}
                    <button id="modal-close-cultivo"
                        style="margin-top:10px;padding:6px 12px;background-color:#2563EB;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
                        Cerrar
                    </button>
                  </div>
                `;
        document.body.appendChild(modal);

        // Cerrar modal
        const closeBtn = modal.querySelector<HTMLButtonElement>("#modal-close-cultivo");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            modal.remove();
            this.highlightLayer.removeAll();
          });
        }

        // Exportar CSV
        const exportBtn = modal.querySelector<HTMLButtonElement>("#export-csv-cultivo");
        if (exportBtn) {
          exportBtn.addEventListener("click", () => {
            if (!intersectados.length) return;
            const keys = Object.keys(intersectados[0].attributes);
            const csvContent = [
              keys.join(","), // encabezado
              ...intersectados.map(f =>
                keys.map(k => `"${(f.attributes[k] ?? '').toString().replace(/"/g, '""')}"`).join(",")
              )
            ].join("\n");

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `superposiciones_${capaBSelTitle}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          });
        }

        // 🔹 Toast resumen
        const resumenMsg = overlapsCount > 0
          ? `✅ Se encontraron ${overlapsCount} superposiciones en ${capaBSelTitle}.`
          : `✅ No se encontraron superposiciones en ${capaBSelTitle}.`;
        this.showToast(resumenMsg, "success", false);
      }
    }
    //Funcion para actualizar las capas del Visor
    actualizarSelectCapas() {
      const selectEl = document.querySelector<HTMLSelectElement>(
        '.file-upload-widget select'
      );
      const selectElCultivo = document.querySelector<HTMLSelectElement>(
        '#analisis-cultivo-widget select'
      );

      if (!selectEl && !selectElCultivo) return;

      // Limpiar opciones en ambos selects (si existen)
      if (selectEl) selectEl.innerHTML = '';
      if (selectElCultivo) selectElCultivo.innerHTML = '';

      const capasExcluir = [
        'DISTRITOS',
        'PROVINCIA',
        'DEPARTAMENTO',
        'PERU',
        'OFICINAS ZONALES',
        'BPP-BOSQUE DE PRODUCCION PERMANENTE',
        'ANP - AREAS NATURALES PROTEGIDAS',
        'MONITOREO DEFORESTACION',
        'COMUNIDADES NATIVAS',
        'ZA-ZONAS DE AMORTIGUAMIENTO',
        'ACR-AREAS DE CONSERVACION REGIONAL',
        'VISITAS DE MONITOREO',
        'POLIGONOS DE CULTIVO' // excluido solo si no quieres analizarlo
      ];

      this.mapa.layers.toArray().forEach((lyr) => {
        const tituloLyr = lyr.title?.toUpperCase() || '';
        if (capasExcluir.includes(tituloLyr)) return;

        if (
          lyr.type === 'feature' ||
          lyr.type === 'geojson' ||
          lyr.type === 'csv'
        ) {
          const opt = document.createElement('option');
          opt.value = lyr.id;
          opt.text = lyr.title || lyr.id;
          if (selectEl) selectEl.appendChild(opt.cloneNode(true));
          if (selectElCultivo) selectElCultivo.appendChild(opt);
        } else if (lyr.type === 'map-image') {
          (lyr as __esri.MapImageLayer).sublayers?.forEach((sub) => {
            const tituloSub = (sub as any).title?.toUpperCase() || '';
            if (capasExcluir.includes(tituloSub)) return;
            const opt = document.createElement('option');
            opt.value = sub.id.toString();
            opt.text = (sub as any).title || `${lyr.title}`;
            if (selectEl) selectEl.appendChild(opt.cloneNode(true));
            if (selectElCultivo) selectElCultivo.appendChild(opt);
          });
        }
      });
    }
}
