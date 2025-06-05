// api/[shortId].js
import { createClient } from '@supabase/supabase-js';

// Inizializza Supabase Client (assicurati che queste variabili siano impostate su Vercel!)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
    // Estrai il shortId dai parametri dell'URL dinamico (es. /ABCD)
    const { shortId } = req.query;

    if (!shortId) {
        // Questo caso non dovrebbe verificarsi per un URL come s.reav.space/XYZ
        return res.status(400).send('Short ID is missing.');
    }

    try {
        // Cerca l'URL lungo corrispondente nel database Supabase
        const { data, error } = await supabase
            .from('short_urls') // Il nome della tua tabella
            .select('long_url')
            .eq('short_id', shortId)
            .single(); // Ci aspettiamo un solo risultato

        if (error && error.code === 'PGRST116') { // Errore di "no rows found" in Supabase
            console.warn(`Short URL '${shortId}' not found in DB.`, error);
            return res.status(404).send('Short URL not found.');
        }

        if (error) {
            console.error('Supabase query error during redirect:', error);
            return res.status(500).send('Internal server error during redirect.');
        }

        if (!data) { // Nessun dato trovato (es. riga cancellata tra query e fetch)
            return res.status(404).send('Short URL not found.');
        }

        // Reindirizza il browser all'URL lungo
        res.writeHead(302, {
            Location: data.long_url
        });
        res.end();

    } catch (error) {
        console.error('Server error during redirect:', error);
        res.status(500).send('Internal server error during redirect.');
    }
}