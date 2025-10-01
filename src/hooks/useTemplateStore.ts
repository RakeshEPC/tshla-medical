import { useEffect, useState } from 'react';
import templateStore from '@/lib/templateStore';
import { SOAPTemplate } from '@/lib/soapTemplates';

export function useTemplateStore() {
  const [templates, setTemplates] = useState<SOAPTemplate[]>([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('guest');

  useEffect(() => {
    // Initial load
    const loadData = () => {
      setTemplates(templateStore.getAllTemplates());
      setDefaultTemplateId(templateStore.getDefaultTemplateId());
      setCurrentUser(templateStore.getCurrentUser());
    };

    loadData();

    // Subscribe to changes
    const unsubscribe = templateStore.subscribe(loadData);

    // Check auth status
    templateStore.checkAuthStatus().then(loadData);

    return unsubscribe;
  }, []);

  return {
    templates,
    defaultTemplateId,
    currentUser,
    defaultTemplate: templateStore.getDefaultTemplate(),
    setDefaultTemplate: (id: string) => templateStore.setDefaultTemplate(id),
    saveCustomTemplate: (template: SOAPTemplate) => templateStore.saveCustomTemplate(template),
    deleteCustomTemplate: (id: string) => templateStore.deleteCustomTemplate(id),
    getTemplateById: (id: string) => templateStore.getTemplateById(id),
    exportSettings: () => templateStore.exportSettings(),
    importSettings: (data: any) => templateStore.importSettings(data),
    refreshTemplates: () => templateStore.refreshTemplates(),
  };
}
