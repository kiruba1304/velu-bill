import React, { useState } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  FolderOpen,
  Save,
  X,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { useCategories } from '../hooks/useDatabase';
import { Category } from '../types';
import { useAuth } from '../hooks/useAuth';

const Categories: React.FC = () => {
  const { categories, loading, error, addCategory, updateCategory, deleteCategory, refreshCategories } = useCategories();
  const { branches } = useAuth();
  const defaultBranches = branches.map(b => b.name).join(',');

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customizationEnabled: false,
    returnWindowDays: '' as string | number,
    allowedBranches: ''
  });

  React.useEffect(() => {
    if (branches.length > 0 && !formData.allowedBranches && !editingCategory) {
      setFormData(prev => ({
        ...prev,
        allowedBranches: defaultBranches
      }));
    }
  }, [branches]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const parsedDays = formData.returnWindowDays !== '' && formData.returnWindowDays !== null && formData.returnWindowDays !== undefined
        ? parseInt(String(formData.returnWindowDays))
        : undefined;

      const categoryData = {
        name: formData.name,
        description: formData.description,
        customizationEnabled: formData.customizationEnabled,
        returnWindowDays: parsedDays !== undefined && !isNaN(parsedDays) ? parsedDays : undefined,
        allowedBranches: formData.allowedBranches
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryData);
        setEditingCategory(null);
      } else {
        await addCategory(categoryData);
      }

      resetForm();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      customizationEnabled: false,
      returnWindowDays: '',
      allowedBranches: defaultBranches
    });
    setShowAddForm(false);
    setEditingCategory(null);
  };

  const handleEdit = (category: Category) => {
    setFormData({
      name: category.name,
      description: category.description || '',
      customizationEnabled: category.customizationEnabled || false,
      returnWindowDays: (category.returnWindowDays !== undefined && category.returnWindowDays !== null) ? category.returnWindowDays : '',
      allowedBranches: category.allowedBranches || defaultBranches
    });
    setEditingCategory(category);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this category? Products in this category will be set to Uncategorized.')) {
      try {
        await deleteCategory(id);
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Failed to delete category. Please try again.');
      }
    }
  };

  const triggerManualSync = () => {
    setIsSyncing(true);
    // Dispatch manual trigger to useECommerceIntegration sync loop
    window.dispatchEvent(new CustomEvent('trigger-ecommerce-sync'));
    
    // Simulate indicator spinning for 1.5 seconds
    setTimeout(() => {
      setIsSyncing(false);
      refreshCategories();
    }, 1500);
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FolderOpen className="mx-auto mb-4 h-12 w-12 animate-pulse text-slate-400" />
            <p className="text-slate-500">Loading categories...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FolderOpen className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <p className="mb-2 text-red-500">Error loading categories</p>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Classification</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Categories Management</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Group and classify products. Changes automatically sync to your E-Commerce catalog.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <button
            onClick={triggerManualSync}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-primary-600' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync with Web'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            Add New Category
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search categories by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pr-10 w-full max-w-md"
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Add/Edit Category Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="input w-full"
                  placeholder="e.g. Sarees, Kurtis"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="input w-full h-24 resize-none py-2"
                  placeholder="Enter category description"
                />
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="customizationEnabled"
                  checked={formData.customizationEnabled}
                  onChange={(e) => handleInputChange('customizationEnabled', e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
                <label htmlFor="customizationEnabled" className="text-sm font-medium text-gray-700">
                  Customization Tailoring Enabled
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Window Days
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.returnWindowDays}
                  onChange={(e) => handleInputChange('returnWindowDays', e.target.value)}
                  className="input w-full"
                  placeholder="e.g. 7, 10 or blank"
                />
              </div>


              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-2 py-2"
                >
                  <Save className="h-4 w-4" />
                  {editingCategory ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary flex-1 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories Table */}
      <div className="card border border-white/60 bg-white/85 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Category Catalog</h2>
          <span className="text-sm text-slate-500">
            {filteredCategories.length} category/categories found
          </span>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-medium text-slate-900">No categories found</h3>
            <p className="text-slate-600">
              {searchTerm ? 'Adjust your search term' : 'Add your first category using the button above'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-soft">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">Category Info</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">Description</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">Customization</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">Return Window</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">Branch Access</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">Sync Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{category.name}</div>
                      <div className="text-xs text-slate-500">Local ID: {category.id}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm max-w-xs truncate">
                      {category.description || <span className="italic text-slate-400">No description</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${category.customizationEnabled ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                        {category.customizationEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {category.returnWindowDays !== undefined ? `${category.returnWindowDays} Days` : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {(category.allowedBranches || defaultBranches)
                          .split(',')
                          .map(b => b.trim())
                          .filter(Boolean)
                          .map(branchName => (
                            <span key={branchName} className="badge bg-blue-50 text-blue-700 text-[10px] py-0.5 px-1.5 rounded-full border border-blue-100">
                              {branchName}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>Synced</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(category)}
                          className="btn-icon btn-icon-primary"
                          title="Edit Category"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="btn-icon btn-icon-danger"
                          title="Delete Category"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Categories;
