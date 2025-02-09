import { Client, Databases, Query } from 'node-appwrite';

// Función para reintentar una operación
async function retryOperation(operation, retries = 3, delay = 1000, log) {
  try {
    return await operation();
  } catch (err) {
    if (retries > 0) {
      log(`Error: ${err.message}. Reintentando... (${retries} intentos restantes)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay, log);
    } else {
      throw err;
    }
  }
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT_S)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.API_KEY_INTERNAL);

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
      log('Request Body:', requestBody);
    } catch (parseError) {
      return res.json({
        error: "Invalid JSON body",
        status: 400,
      });
    }

    const { userId, fallasIds, idsEvents, onlySavedEvents, page } = requestBody;

    var twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    var queryEventsCollection = [
      Query.orderAsc('dateInit'),
      Query.greaterThan('dateInit', twoDaysAgo.toISOString()),
      Query.limit(150),
    ];
    var savedEventIds = [];
    var fallasCollection = [];

    // Si el usuario está autenticado, obtener los eventos guardados por el usuario
    if (userId && userId !== "") {
      log("User ID: " + userId);

      // Obtener los ids de los eventos guardados del usuario con reintentos
      let userEvents;
      try {
        userEvents = await retryOperation(
          () =>
            databases.listDocuments(DATABASE_ID_EVENTS, USER_EVENTS_COLLECTION_ID, [
              Query.equal('idUser', userId),
              Query.limit(150),
            ]),
          3, // Número de reintentos
          1000, // Retraso entre reintentos (1 segundo)
          log // Pasar la función log
        );
      } catch (err) {
        log("Error fetching user events: " + err.message);
      }

      log("User Events:", userEvents);

      // Obtener una lista de IDs de eventos guardados por el usuario
      if (userEvents && userEvents.documents.length > 0) {
        savedEventIds = userEvents.documents.map((doc) => doc.idEvent);
      }
    }

    // Si se proporcionan los IDs de las fallas, obtener las fallas
    if (fallasIds && fallasIds.length > 0) {
      log("Fallas IDs: " + fallasIds);
      queryEventsCollection.push(Query.equal('idFalla', fallasIds));

      // Obtener las fallas con reintentos
      try {
        fallasCollection = await retryOperation(
          () =>
            databases.listDocuments(DATABASE_ID_USERS, FALLAS_COLLECTION_ID, [
              Query.equal('$id', fallasIds),
            ]),
          3, // Número de reintentos
          1000, // Retraso entre reintentos (1 segundo)
          log // Pasar la función log
        );
      } catch (err) {
        log("Error fetching fallas: " + err.message);
      }
    }

    // Si se proporcionan los IDs de los eventos, obtener los eventos
    if (idsEvents && idsEvents.length > 0) {
      log("IDs Events: " + idsEvents);
      queryEventsCollection.push(Query.equal('$id', idsEvents));
    }

    // Si se solicitan solo los eventos guardados, añadir el filtro de los eventos guardados
    if (onlySavedEvents && onlySavedEvents === true && userId && userId !== "") {
      log("Only saved events");
      queryEventsCollection.push(Query.equal('$id', savedEventIds));
    }

    // Si se proporciona el número de página, calcular el offset
    if (page) {
      log("Page: " + page);
      //const limit = 150;
      //const offset = (page - 1) * limit;
      //queryEventsCollection.push(Query.limit(limit));
      //queryEventsCollection.push(Query.offset(offset));
    }

    log("Query Events Collection:", queryEventsCollection);

    // Obtener todos los eventos o los eventos filtrados por fallas con reintentos
    let events;
    try {
      events = await retryOperation(
        () =>
          databases.listDocuments(DATABASE_ID_EVENTS, EVENTS_COLLECTION_ID, queryEventsCollection),
        3, // Número de reintentos
        1000, // Retraso entre reintentos (1 segundo)
        log // Pasar la función log
      );
    } catch (err) {
      log("Error fetching events: " + err.message);
      return res.json({
        error: "Error fetching events",
        status: 500,
      });
    }

    // Si no se obtuvieron fallas previamente, obtener las fallas asociadas a los eventos
    if (fallasCollection.length === 0) {
      try {
        fallasCollection = await retryOperation(
          () =>
            databases.listDocuments(DATABASE_ID_USERS, FALLAS_COLLECTION_ID, [
              Query.equal('$id', events.documents.map((event) => event.idFalla)),
            ]),
          3, // Número de reintentos
          1000, // Retraso entre reintentos (1 segundo)
          log // Pasar la función log
        );
      } catch (err) {
        log("Error fetching fallas: " + err.message);
      }
    }

    log("Fallas Collection:", fallasCollection);

    // Combinar la información: añade el campo isSaved a los eventos
    const eventsWithSavedStatus = events.documents.map((event) => {
      var fallaEvent = fallasCollection.documents.find((falla) => falla.$id === event.idFalla);
      return {
        ...event,
        isSaved: savedEventIds.includes(event.$id),
        urlImageFalla: fallaEvent ? fallaEvent.imageUrl : null,
        nameFalla: fallaEvent ? fallaEvent.name : null,
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
      status: 500,
    });
  }
};