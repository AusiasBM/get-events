import { Client, Users, Databases, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const users = new Users(client);
  const databases = new Databases(client);

  const EVENTS_COLLECTION_ID = '66ade7e80028ee7c4db5'; 
  const USER_EVENTS_COLLECTION_ID = '66ade802001fe44176cd'; 
  const DATABASE_ID = '66ade7d7000a17124be2';

  try {
    // Log total users as an example
    const response = await users.list();
    log(`Total users: ${response.total}`);

    // Intentar parsear manualmente el body si no se está recibiendo como JSON
    let requestBody;
    try {
      
       requestBody = req.body ;
       
       
     
    } catch (parseError) {
      return res.json({
        error: "Invalid JSON body",
        status: 400
      });
    }

    const { userId } = requestBody;
    log(`Total body: ${userId}`);

    if (!userId) {
      return res.json({
        error: "userId is required",
        status: 400
      });
    }

    // Obtener los eventos del usuario
    const userEvents = await databases.listDocuments(DATABASE_ID, USER_EVENTS_COLLECTION_ID, [
      Query.equal('idUser', userId),
    ]);

    // Obtener una lista de IDs de eventos guardados por el usuario
    const savedEventIds = userEvents.documents.map((doc) => doc.idEvent);

    // Obtener todos los eventos
    const events = await databases.listDocuments(DATABASE_ID, EVENTS_COLLECTION_ID);

    // Combinar la información: añade el campo isSaved a los eventos
    const eventsWithSavedStatus = events.documents.map((event) => ({
      ...event,
      isSaved: savedEventIds.includes(event.$id),
    }));

    // Responder con los eventos y el estado isSaved
    return res.json({
      events: eventsWithSavedStatus,
    });

  } catch (err) {
    // Manejo de errores
    error("Error fetching events: " + err.message);
    return res.json({
      error: err.message,
      status: 500
    });
  }
};
