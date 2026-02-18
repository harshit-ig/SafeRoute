const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Path point schema (embedded in Path)
const PathPointSchema = new Schema({
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    order: { type: Number, required: true },
    isSource: { type: Boolean, default: false },
    isDestination: { type: Boolean, default: false },
    isWaypoint: { type: Boolean, default: true }
});

// Path schema (embedded in Route)
const PathSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    points: [PathPointSchema]
});

// Route schema
const RouteSchema = new Schema({
    id: { type: String, required: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    sourceLat: { type: Number, required: true },
    sourceLng: { type: Number, required: true },
    destinationLat: { type: Number, required: true },
    destinationLng: { type: Number, required: true },
    sourceAddress: { type: String, default: '' },
    destinationAddress: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    paths: [PathSchema]
}, { 
    timestamps: true 
});

// Create index for faster queries
RouteSchema.index({ userId: 1 });
RouteSchema.index({ id: 1 }, { unique: true });

// Convert MongoDB _id to id before sending to client
RouteSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.createdAt = ret.createdAt ? ret.createdAt.getTime() : Date.now();
        ret.updatedAt = ret.updatedAt ? ret.updatedAt.getTime() : Date.now();
        return ret;
    }
});

module.exports = mongoose.model('Route', RouteSchema); 