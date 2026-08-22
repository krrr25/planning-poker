import { Router } from 'express';
import { requireAdmin } from '../auth.js';
import { isAzureConfigured, listProjects } from '../services/azure-devops.js';

export const azureRouter = Router();

azureRouter.get('/projects', requireAdmin, (_req, res) => {
  res.json({
    configured: isAzureConfigured(),
    projects: listProjects(),
  });
});
