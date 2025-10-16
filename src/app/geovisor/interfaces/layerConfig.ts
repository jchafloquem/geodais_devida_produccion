export interface LayerConfig {
  type: 'feature' | 'map-image' | 'webtile';
  url: string;
  title?: string;
  group: string;
  visible?: boolean;
  opacity?: number;
  minScale?: number;
  maxScale?: number;
  // 🔹 Propios de FeatureLayer
  popupTemplate?: __esri.PopupTemplate;
  renderer?: __esri.Renderer;
  labelingInfo?: __esri.LabelClass[];
  labelsVisible?: boolean;
  outFields?: string[];
  featureReduction?: any;
  // 🔹 Propios de MapImageLayer
  sublayers?: {
    id: number;
    title?: string;
    visible?: boolean;
    definitionExpression?: string;
    popupTemplate?: __esri.PopupTemplate;
    labelingInfo?: __esri.LabelClass[];
    labelsVisible?: boolean;
    renderer?: __esri.Renderer;
    minScale?: number;
    maxScale?: number;
  }[];
}
