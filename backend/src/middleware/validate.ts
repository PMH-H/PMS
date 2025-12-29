import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject) => (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // Optionally replace req.body/query/params with validated data to ensure type safety
        // req.body = validated.body;
        // req.query = validated.query;
        // req.params = validated.params;

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Validation Error',
                details: error.errors.map(e => ({ path: e.path, message: e.message })),
            });
        }
        console.error('Validation Middleware Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
