
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { PropertyWithImages, DatabasePropertyImage } from "@/hooks/useProperties";

type PropertyType = Tables<'properties'>['type'];
type PropertyStatus = Tables<'properties'>['status'];

interface PropertyFormData {
  propertyCode: string;
  title: string;
  type: PropertyType;
  price: string;
  area: string;
  bedrooms: string;
  bathrooms: string;
  address: string;
  city: string;
  state: string;
  status: PropertyStatus;
  description: string;
}

export function usePropertyEdit(property: PropertyWithImages) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PropertyFormData>({
    propertyCode: property.id,
    title: property.title,
    type: property.type as PropertyType,
    price: property.price.toString(),
    area: property.area.toString(),
    bedrooms: property.bedrooms?.toString() || "",
    bathrooms: property.bathrooms?.toString() || "",
    address: property.address,
    city: property.city,
    state: property.state,
    status: property.status as PropertyStatus,
    description: property.description || "",
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<DatabasePropertyImage[]>(property.property_images || []);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const checkPropertyCodeExists = async (code: string, currentId: string) => {
    if (!code.trim() || code.trim() === currentId) return false;
    
    console.log('🔍 Verificando se código existe (TEXT) - Edit:', code.trim());
    try {
      const { data, error, count } = await supabase
        .from('imoveisvivareal')
        .select('*', { count: 'exact', head: true })
        .eq('id', code.trim());

      console.log('📊 Resultado da verificação (count) - Edit:', { count, error });

      if (error) {
        console.error('❌ Erro ao verificar código - Edit:', error);
        return false;
      }

      const exists = (count || 0) > 0;
      console.log('✅ Código existe? - Edit:', exists);
      return exists;
    } catch (error) {
      console.error('💥 Erro na verificação - Edit:', error);
      return false;
    }
  };

  const uploadNewImages = async (propertyId: string) => {
    if (imageFiles.length === 0) return [];

    const uploadPromises = imageFiles.map(async (file, index) => {
      // Como as imagens já foram convertidas para WebP, usar sempre .webp
      const fileName = `${propertyId}/${Date.now()}_${index}.webp`;

      console.log('📤 Fazendo upload da imagem WebP:', fileName, 'Tamanho:', (file.size / 1024).toFixed(2), 'KB');

      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(fileName, file, {
          contentType: 'image/webp',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Erro no upload:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(fileName);

      console.log('🔗 URL pública WebP gerada:', publicUrl);

      const { error: insertError } = await supabase
        .from('property_images')
        .insert({
          property_id: propertyId,
          image_url: publicUrl,
          image_order: existingImages.length + index
        });

      if (insertError) {
        console.error('❌ Erro ao inserir no banco:', insertError);
        throw insertError;
      }
      
      return publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  const deleteMarkedImages = async () => {
    if (imagesToDelete.length === 0) return;

    console.log('🗑️ Deletando imagens marcadas:', imagesToDelete);

    const deletePromises = imagesToDelete.map(async (imageId) => {
      const { error } = await supabase
        .from('property_images')
        .delete()
        .eq('id', imageId);

      if (error) {
        console.error('❌ Erro ao deletar imagem:', error);
        throw error;
      }
      console.log('✅ Imagem deletada com sucesso:', imageId);
    });
    await Promise.all(deletePromises);
  };

  const handleSubmit = async (onSuccess: () => void) => {
    if (!formData.propertyCode || !formData.title || !formData.type || !formData.price || !formData.area || !formData.address || !formData.city || !formData.state) {
      toast({
        title: "Erro no formulário",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Verificar se o código mudou e se já existe
    if (formData.propertyCode !== property.id) {
      const codeExists = await checkPropertyCodeExists(formData.propertyCode, property.id);
      if (codeExists) {
        toast({
          title: "Código já existe",
          description: "Este código de imóvel já está sendo usado. Por favor, escolha outro.",
          variant: "destructive",
        });
        return;
      }
    }

    console.log('💾 Iniciando salvamento da propriedade...');
    setLoading(true);

    try {
      console.log('📝 Atualizando dados na tabela properties para ID:', property.id);
      
      // Se o código mudou, precisamos atualizar o ID
      if (formData.propertyCode !== property.id) {
        // Primeiro, criar um novo registro com o novo ID
        const { error: insertError } = await supabase
          .from('imoveisvivareal')
          .insert({
            id: formData.propertyCode.trim(),
            title: formData.title,
            type: formData.type,
            price: parseFloat(formData.price),
            area: parseFloat(formData.area),
            bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
            bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            status: formData.status,
            description: formData.description || null,
          });

        if (insertError) throw insertError;

        // Atualizar imagens para o novo ID
        if (existingImages.length > 0) {
          const { error: updateImagesError } = await supabase
            .from('property_images')
            .update({ property_id: formData.propertyCode.trim() })
            .eq('property_id', property.id);

          if (updateImagesError) throw updateImagesError;
        }

        // Deletar o registro antigo
        const { error: deleteError } = await supabase
          .from('imoveisvivareal')
          .delete()
          .eq('id', property.id);

        if (deleteError) throw deleteError;
      } else {
        // Apenas atualizar os dados existentes
        const { error: propertyError } = await supabase
          .from('imoveisvivareal')
          .update({
            title: formData.title,
            type: formData.type,
            price: parseFloat(formData.price),
            area: parseFloat(formData.area),
            bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
            bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            status: formData.status,
            description: formData.description || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', property.id);

        if (propertyError) throw propertyError;
      }

      // 2. Delete marked images
      await deleteMarkedImages();

      // 3. Upload new images if any
      if (imageFiles.length > 0) {
        console.log('📤 Fazendo upload de novas imagens...');
        await uploadNewImages(property.id);
      }

      console.log('✅ Propriedade atualizada com sucesso!');
      
      toast({
        title: "Sucesso!",
        description: "Propriedade atualizada com sucesso.",
      });

      // Aguardar um pequeno delay para garantir que o real-time update seja processado
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (error) {
      console.error('💥 Erro ao atualizar propriedade:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar propriedade. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    loading,
    imageFiles,
    imagePreviewUrls,
    existingImages,
    imagesToDelete,
    handleFormChange,
    handleSubmit,
    setImageFiles,
    setImagePreviewUrls,
    setExistingImages,
    setImagesToDelete,
    checkPropertyCodeExists,
  };
}
