import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import clientRoutes from './modules/client/client.routes';
import pharmacyRoutes from './modules/pharmacy/pharmacy.routes';
import notificationRoutes from './modules/notification/notification.routes';

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '2.0.5',
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/client', clientRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/notifications', notificationRoutes);

export default app;
