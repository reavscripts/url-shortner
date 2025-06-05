// api/shorten.js
import { createClient } from '@supabase/supabase-js';
import { customAlphabet } from 'nanoid';

// Inizializza Supabase Client
// Assicurati che le variabili d'ambiente SUPABASE_URL e SUPABASE_ANON_KEY
// siano impostate correttamente nel tuo progetto Vercel (dashboard Vercel -> Settings -> Environment Variables)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Funzione per generare un ID breve unico
// 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' sono i caratteri che possono essere usati
// 7 è la lunghezza dell'ID breve
const generateShortId = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 7);

export default async function handler(req, res) {
    // Permette solo richieste POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { long_url } = req.body;

    // Validazione base dell'URL lungo
    if (!long_url || !long_url.startsWith('http://') && !long_url.startsWith('https://')) {
        return res.status(400).json({ message: 'Invalid URL provided. Please ensure it starts with http:// or https://' });
    }

    try {
        // 1. Controlla se l'URL lungo esiste già nel database
        // Questo evita di creare duplicati se lo stesso URL viene accorciato più volte
        const { data: existingUrl, error: existingError } = await supabase
            .from('short_urls') // Il nome della tua tabella Supabase
            .select('short_id')
            .eq('long_url', long_url)
            .single(); // Ci aspettiamo un solo risultato

        if (existingUrl) {
            // Se l'URL lungo esiste già, restituisci l'ID breve esistente
            // Utilizziamo process.env.VERCEL_URL per ottenere il dominio corretto (es. url-shortner.reav.space)
            // Se VERCEL_URL non è definito (es. in sviluppo locale), usiamo http://localhost:3000
            const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
            const shortUrl = `${baseUrl}/${existingUrl.short_id}`;
            return res.status(200).json({ shortUrl });
        }

        // 2. Genera un nuovo short ID unico
        let shortId;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10; // Limita i tentativi per evitare loop infiniti in caso di collisioni estreme

        while (!isUnique && attempts < maxAttempts) {
            shortId = generateShortId();
            const { data: duplicateId, error: duplicateError } = await supabase
                .from('short_urls')
                .select('short_id')
                .eq('short_id', shortId)
                .single();

            // Se duplicateId è null, significa che non è stato trovato nessun record con quell'ID, quindi è unico.
            // PGRST116 è il codice di errore di Supabase per "nessuna riga trovata".
            if (!duplicateId || (duplicateError && duplicateError.code === 'PGRST116')) {
                isUnique = true; // L'ID è unico e può essere usato
            } else if (duplicateError) {
                // Altri errori di Supabase durante la ricerca (non solo "nessuna riga")
                throw duplicateError;
            }
            attempts++;
        }

        if (!isUnique) {
            return res.status(500).json({ message: 'Failed to generate a unique short ID after multiple attempts.' });
        }


        // 3. Salva l'URL lungo e l'ID breve nel database
        const { data, error } = await supabase
            .from('short_urls')
            .insert([{ long_url, short_id: shortId }])
            .select(); // select() per ottenere i dati del record appena inserito

        if (error) {
            console.error('Supabase insert error:', error);
            // In caso di errore, restituisci un messaggio chiaro al client
            return res.status(500).json({ message: 'Error saving URL to database.', error: error.message });
        }

        // Costruisci l'URL breve completo usando il dominio del progetto Vercel
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
        const shortUrl = `${baseUrl}/${shortId}`;

        // Restituisci l'URL breve generato al client
        res.status(200).json({ shortUrl });

    } catch (error) {
        console.error('Catch all server error in shorten.js:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
}