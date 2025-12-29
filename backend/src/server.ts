import app from './app';
// import { env } from './config/env'; // Env is loaded in app.ts via config/env
import { initNotificationListeners } from './modules/notification/notification.service';

const PORT = process.env.PORT || 3000;

// Initialize Services
initNotificationListeners();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
