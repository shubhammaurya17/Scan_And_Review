import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// Dashboard stats
router.get('/stats', adminController.getStats);

// System
router.get('/health', adminController.getHealth);
router.get('/ai/config', adminController.getAIConfig);

// Businesses
router.get('/businesses', adminController.listBusinesses);
router.post('/businesses', adminController.createBusiness);
router.put('/businesses/:id', adminController.updateBusiness);
router.delete('/businesses/:id', adminController.deleteBusiness);

// Categories
router.get('/categories', adminController.listCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Question templates
router.get('/categories/:categoryId/templates', adminController.getTemplates);
router.post('/categories/:categoryId/templates', adminController.createTemplate);
router.put('/categories/:categoryId/templates/:templateId', adminController.updateTemplate);
router.delete('/categories/:categoryId/templates/:templateId', adminController.deleteTemplate);

// Users
router.get('/users', adminController.listUsers);

export default router;
