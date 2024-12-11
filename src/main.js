import { Client, Databases, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT_S)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const databases = new Databases(client);

  // Variables de entorno
  const EVENTS_COLLECTION_ID = process.env.EVENTS_COLLECTION_ID; 
  const USER_EVENTS_COLLECTION_ID = process.env.USER_EVENTS_COLLECTION_ID; 
  const FALLAS_COLLECTION_ID = process.env.FALLAS_COLLECTION_ID;
  const DATABASE_ID_EVENTS = process.env.DATABASE_ID_EVENTS;
  const DATABASE_ID_USERS = process.env.DATABASE_ID_USERS;

  try {
    let requestBody;
    try {
      requestBody = JSON.parse(req.body);
      log(requestBody);
      
    } catch (parseError) {
      return res.json({
        error: "Invalid JSON body",
        status: 400
      });
    }

    const { userId, fallasIds, idsEvents, onlySavedEvents, page } = requestBody;

    var twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    var queryEventsCollection = [
      Query.orderAsc('dateInit'),
      Query.greaterThan('dateInit', twoDaysAgo.toISOString()),
    ];
    var savedEventIds = [];
    var fallasCollection = [];

    // Si el usuario está autenticado, obtener los eventos guardados por el usuario
    if (userId && userId !== "") {
      log("User ID: " + userId);
      // Obtener los ids de los eventos guardados del usuario
      let userEvents;
      try {
        userEvents = await databases.listDocuments(DATABASE_ID_EVENTS, USER_EVENTS_COLLECTION_ID, [
          Query.equal('idUser', userId),
        ]);
      } catch (error) {
        log("Error fetching user events: " + error.message);
      }

      log("User Events: " + userEvents);

      // Obtener una lista de IDs de eventos guardados por el usuario
      if( userEvents && userEvents.documents.length > 0) {
        savedEventIds = userEvents.documents.map((doc) => doc.idEvent);
      }
    }
    // ******************************************************************************

    // Si se proporcionan los IDs de las fallas, obtener las fallas
    if (fallasIds && fallasIds.length > 0) {
      log("Fallas IDs: " + fallasIds);
      queryEventsCollection.push(Query.equal('idFalla', fallasIds));

      // Obtener las fallas
       fallasCollection = await databases.listDocuments(DATABASE_ID_USERS, FALLAS_COLLECTION_ID, [
        Query.equal('$id', fallasIds),
      ]);
    }
    // ******************************************************************************

    // Si se proporcionan los IDs de los eventos, obtener los eventos
    if (idsEvents && idsEvents.length > 0) {
      log("IDs Events: " + idsEvents);
      queryEventsCollection.push(Query.equal('$id', idsEvents));
    }
    // ******************************************************************************

    // Si se solicitan solo los eventos guardados, añadir el filtro de los eventos guardados
    if(onlySavedEvents && onlySavedEvents === true && userId && userId !== "") {
      log("Only saved events");
      queryEventsCollection.push(Query.equal('$id', savedEventIds));
    }
    // ******************************************************************************

    // Si se proporciona el número de página, calcular el offset
    if (page) {
      log("Page: " + page);
      const limit = 25;
      const offset = (page - 1) * limit;
      //queryEventsCollection.push(Query.limit(limit));
      //queryEventsCollection.push(Query.offset(offset));
    }

    log(queryEventsCollection);

    // Obtener todos los eventos o los eventos filtrados por fallas
    const events = await databases.listDocuments(DATABASE_ID_EVENTS, EVENTS_COLLECTION_ID, queryEventsCollection);

    if(fallasCollection.length === 0) {
      fallasCollection = await databases.listDocuments(DATABASE_ID_USERS, FALLAS_COLLECTION_ID, [
        Query.equal('$id', events.documents.map((event) => event.idFalla)),
      ]);
    }

    log("fallas colection: " + fallasCollection);

    // Combinar la información: añade el campo isSaved a los eventos
    const eventsWithSavedStatus = events.documents.map((event) => {
      var fallaEvent = fallasCollection.documents.find((falla) => falla.$id === event.idFalla);
      return {
        ...event,
        isSaved: savedEventIds.includes(event.$id),
        urlImageFalla: fallaEvent.imageUrl,
        nameFalla: fallaEvent.name,
      };
    });

    // Responder con los eventos y el estado isSaved
    return res.json({
      events: eventsWithSavedStatus,
    });

  } catch (err) {
    // Manejo de errores
    error("Error fetching events: " + err.message);
    error("Error fetching events: " + err);
    return res.json({
      error: err.message,
      status: 500
    });
  }
};
