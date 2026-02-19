const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Route = require('../models/Route');
const User = require('../models/User');
const { protect } = require('../middlewares/authMiddleware');
const logger = require('../utils/logger');

// Get all routes for a user
router.get('/user/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Validate that the user exists
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Get all routes for the user
        const routes = await Route.find({ userId });
        
        return res.status(200).json(routes);
    } catch (error) {
        logger.error(`Error getting routes: ${error.message}`);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Efficiently sync routes by receiving local route IDs and returning only new routes
router.post('/sync/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const { localRouteIds = [] } = req.body;
        
        // Validate that the user exists
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Get all routes for the user
        const allUserRoutes = await Route.find({ userId });
        
        // Filter out routes that already exist locally
        const newRoutes = allUserRoutes.filter(route => !localRouteIds.includes(route.id));
        
        logger.info(`Sync request for user ${userId}: ${localRouteIds.length} local routes, returning ${newRoutes.length} new routes`);
        
        return res.status(200).json({
            totalRoutes: allUserRoutes.length,
            newRoutes: newRoutes
        });
    } catch (error) {
        logger.error(`Error syncing routes: ${error.message}`);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get a specific route
router.get('/:routeId', protect, async (req, res) => {
    try {
        const { routeId } = req.params;
        
        // Find the route by ID
        const route = await Route.findOne({ id: routeId });
        
        if (!route) {
            return res.status(404).json({ message: 'Route not found' });
        }
        
        return res.status(200).json(route);
    } catch (error) {
        logger.error(`Error getting route: ${error.message}`);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create a new route
router.post('/', protect, async (req, res) => {
    try {
        const { id, name, description, sourceLat, sourceLng, destinationLat, destinationLng, 
                sourceAddress, destinationAddress, isActive, paths } = req.body;
        
        // Check if route already exists
        const existingRoute = await Route.findOne({ id });
        if (existingRoute) {
            return res.status(400).json({ message: 'Route with this ID already exists' });
        }
        
        // Get user ID from token
        const userId = req.user.id || req.user._id;
        
        // Create new route
        const route = new Route({
            id,
            userId,
            name,
            description,
            sourceLat,
            sourceLng,
            destinationLat,
            destinationLng,
            sourceAddress,
            destinationAddress,
            isActive,
            paths: paths || [],
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await route.save();
        
        return res.status(201).json(route);
    } catch (error) {
        logger.error(`Error creating route: ${error.message}`);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update a route
router.put('/:routeId', protect, async (req, res) => {
    try {
        const { routeId } = req.params;
        const { name, description, sourceLat, sourceLng, destinationLat, destinationLng, 
                sourceAddress, destinationAddress, isActive, paths } = req.body;
        
        // Find the route
        const route = await Route.findOne({ id: routeId });
        
        if (!route) {
            return res.status(404).json({ message: 'Route not found' });
        }
        
        // Update route fields
        if (name) route.name = name;
        if (description !== undefined) route.description = description;
        if (sourceLat) route.sourceLat = sourceLat;
        if (sourceLng) route.sourceLng = sourceLng;
        if (destinationLat) route.destinationLat = destinationLat;
        if (destinationLng) route.destinationLng = destinationLng;
        if (sourceAddress !== undefined) route.sourceAddress = sourceAddress;
        if (destinationAddress !== undefined) route.destinationAddress = destinationAddress;
        if (isActive !== undefined) route.isActive = isActive;
        if (paths) route.paths = paths;
        
        route.updatedAt = new Date();
        
        await route.save();
        
        return res.status(200).json(route);
    } catch (error) {
        logger.error(`Error updating route: ${error.message}`);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete a route
router.delete('/:routeId', protect, async (req, res) => {
    try {
        const { routeId } = req.params;
        
        // Find and delete the route
        const route = await Route.findOneAndDelete({ id: routeId });
        
        if (!route) {
            return res.status(404).json({ message: 'Route not found' });
        }
        
        return res.status(200).json({ message: 'Route deleted successfully' });
    } catch (error) {
        logger.error(`Error deleting route: ${error.message}`);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router; 