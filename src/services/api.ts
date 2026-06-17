const API_BASE = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:3001/api';

export interface StitchResponse {
  success: boolean;
  filename?: string;
  path?: string;
  stats?: {
    totalImages: number;
    outputWidth: number;
    outputHeight: number;
    format: string;
  };
  error?: string;
  details?: string;
}

export const imageApi = {
  async stitchImages(files: File[]): Promise<StitchResponse> {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append('images', file);
    });

    const response = await fetch(`${API_BASE}/stitch`, {
      method: 'POST',
      body: formData,
      mode: 'cors',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to stitch images');
    }

    return response.json();
  },

  getDownloadUrl(filename: string): string {
    return `${API_BASE}/download/${filename}`;
  },

  async cleanup(): Promise<void> {
    await fetch(`${API_BASE}/cleanup`, { method: 'POST', mode: 'cors' });
  }
};
