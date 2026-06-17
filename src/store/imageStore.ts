import { create } from 'zustand';

export interface ImageFile {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
}

interface ImageStore {
  images: ImageFile[];
  isProcessing: boolean;
  error: string | null;
  result: {
    filename: string;
    path: string;
    stats?: {
      totalImages: number;
      outputWidth: number;
      outputHeight: number;
      format: string;
    };
  } | null;
  
  addImages: (files: File[]) => void;
  removeImage: (id: string) => void;
  reorderImages: (startIndex: number, endIndex: number) => void;
  clearImages: () => void;
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: string | null) => void;
  setResult: (result: ImageStore['result']) => void;
}

export const useImageStore = create<ImageStore>((set) => ({
  images: [],
  isProcessing: false,
  error: null,
  result: null,

  addImages: (files) =>
    set((state) => {
      const newImages = files
        .filter((file) => file.type.startsWith('image/'))
        .map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
        }));
      return { images: [...state.images, ...newImages] };
    }),

  removeImage: (id) =>
    set((state) => {
      const image = state.images.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return { images: state.images.filter((img) => img.id !== id) };
    }),

  reorderImages: (startIndex, endIndex) =>
    set((state) => {
      const newImages = [...state.images];
      const [removed] = newImages.splice(startIndex, 1);
      newImages.splice(endIndex, 0, removed);
      return { images: newImages };
    }),

  clearImages: () =>
    set((state) => {
      state.images.forEach((img) => URL.revokeObjectURL(img.preview));
      return { images: [], result: null, error: null };
    }),

  setProcessing: (isProcessing) => set({ isProcessing }),
  setError: (error) => set({ error }),
  setResult: (result) => set({ result }),
}));
