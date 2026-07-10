import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import BOMCreator from './BOMCreator';

export function CreateBOMPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [projectsResponse, productsData] = await Promise.all([
          apiClient.projects.list(),
          apiClient.products.list(),
        ]);
        const pData = (projectsResponse as any).data ? (projectsResponse as any).data : projectsResponse;
        setProjects(pData);
        setProducts(productsData);
      } catch (e: any) {
        setError(e.message || 'Failed to load necessary data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2">
        <span>Error loading BOM Creator: {error}</span>
      </div>
    );
  }

  return (
    <BOMCreator 
      projects={projects}
      products={products}
      onCancel={() => navigate('/bom')}
      onSuccess={() => navigate('/bom')}
    />
  );
}
