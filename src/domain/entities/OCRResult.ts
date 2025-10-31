import { VisionFeature } from '@shared/types/index.js';

export interface OCRAnnotations {
  textAnnotations?: unknown;
  logoAnnotations?: unknown;
  labelAnnotations?: unknown;
  safeSearchAnnotation?: unknown;
  fullTextAnnotation?: unknown;
}

export interface OCRResultProps {
  id?: string;
  imageUri: string;
  features: VisionFeature[];
  annotations: OCRAnnotations;
  processedAt?: Date;
}

export class OCRResult {
  public readonly id: string;
  public readonly imageUri: string;
  public readonly features: VisionFeature[];
  public readonly annotations: OCRAnnotations;
  public readonly processedAt: Date;

  private constructor(props: OCRResultProps) {
    this.id = props.id ?? this.generateId();
    this.imageUri = props.imageUri;
    this.features = props.features;
    this.annotations = props.annotations;
    this.processedAt = props.processedAt ?? new Date();
  }

  public static create(props: OCRResultProps): OCRResult {
    return new OCRResult(props);
  }

  private generateId(): string {
    return `ocr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  public extractFullText(): string {
    const textAnnotations = this.annotations.textAnnotations as
      | Array<{ description?: string | null }>
      | undefined;
    if (textAnnotations && textAnnotations.length > 0) {
      return textAnnotations[0]?.description ?? '';
    }
    return '';
  }

  public extractLogos(): string[] {
    const logoAnnotations = this.annotations.logoAnnotations as
      | Array<{ description?: string | null }>
      | undefined;
    if (!logoAnnotations) {
      return [];
    }
    return logoAnnotations.map((logo) => logo.description ?? '').filter((desc) => desc !== '');
  }

  public extractLabels(limit = 5): string[] {
    const labelAnnotations = this.annotations.labelAnnotations as
      | Array<{ description?: string | null }>
      | undefined;
    if (!labelAnnotations) {
      return [];
    }
    return labelAnnotations
      .slice(0, limit)
      .map((label) => label.description ?? '')
      .filter((desc) => desc !== '');
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      imageUri: this.imageUri,
      features: this.features,
      annotations: this.annotations,
      processedAt: this.processedAt.toISOString(),
    };
  }
}
