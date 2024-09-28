import { Client, Users } from 'node-appwrite';

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  // You can use the Appwrite SDK to interact with other services
  // For this example, we're using the Users service
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  
    const users = new Users(client);
    const databases = new Databases(client);

    const EVENTS_COLLECTION_ID = '66ade7e80028ee7c4db5'; // ID de la colección de eventos
    const USER_EVENTS_COLLECTION_ID = '66ade802001fe44176cd'; // ID de la colección user_event
    const DATABASE_ID = '66ade7d7000a17124be2'; // ID de la base de datos

  try {
    const response = await users.list();
    // Log messages and errors to the Appwrite Console
    // These logs won't be seen by your end users
    log(`Total users: ${response.total}`);

     // Obtener los eventos del usuario
     const userId = req.query.userId; // Suponemos que recibes el userId por query params
     const userEvents = await databases.listDocuments(DATABASE_ID, USER_EVENTS_COLLECTION_ID, [
       sdk.Query.equal('userId', userId),
     ]);
 
     // Obtener una lista de IDs de eventos guardados por el usuario
     const savedEventIds = userEvents.documents.map((doc) => doc.eventId);
 
     // Obtener todos los eventos
     const events = await databases.listDocuments(DATABASE_ID, EVENTS_COLLECTION_ID);
 
     // Combinar la información: añade el campo isSaved a los eventos
     const eventsWithSavedStatus = events.documents.map((event) => ({
       ...event,
       isSaved: savedEventIds.includes(event.$id), // Si el evento está guardado, marcarlo como isSaved
     }));
 
     // Responder con los eventos y el estado isSaved
     return res.json({
       events: eventsWithSavedStatus,
     });
  } catch(err) {
    error("Could not list users: " + err.message);
  }

  // The req object contains the request data
  if (req.path === "/ping") {
    // Use res object to respond with text(), json(), or binary()
    // Don't forget to return a response!
    return res.text("Pong");
  }

  return res.json({
    motto: "Build like a team of hundreds_",
    learn: "https://appwrite.io/docs",
    connect: "https://appwrite.io/discord",
    getInspired: "https://builtwith.appwrite.io",
  });
};
