import uuid from '../lib/uuid';
import compose from '../lib/compose';
import Model from './model';

let modelFactories;
let eventFactories;

/**
 * @typedef {Object} Model
 * @property {Function} getId
 * @property {function} getModelName
 */

/**
 * @typedef {Object} Event
 * @property {Function} getId
 * @property {Function} getEventName
 */

/**
 * @typedef {Object} EventTypes
 * @property {String} CREATE
 * @property {String} UPDATE
 * @property {String} DELETE
 */
export const EventTypes = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE'
}

function checkModelName(modelName) {
  if (typeof modelName === 'string') {
    return modelName.toUpperCase();
  }
  throw new Error('modelName missing or invalid');
}

function checkEventType(eventType) {
  if (typeof eventType === 'string') {
    eventType = eventType.toUpperCase();
    if (Object.keys(EventTypes).includes(eventType)) {
      return eventType;
    }
  }
  throw new Error('eventType missing or invalid');
}

export function createEventName(eventType, modelName) {
  return checkEventType(eventType) + checkModelName(modelName);
}

function addId(o) {
  const _id = o.generateId();
  return Object.assign({}, o, {
    id: _id,
    getId: () => _id
  });
}

function addEventName(o) {
  const {
    eventType,
    modelName
  } = o;

  const _eventName = createEventName(
    eventType,
    modelName
  );

  return Object.assign({}, o, {
    eventName: _eventName,
    getEventName: () => _eventName,
  });
}

function addModelName(o) {
  const {
    modelName
  } = o;

  return Object.assign({}, o, {
    modelName: modelName,
    getModelName: () => modelName
  });
}

function addTimestamp(o) {
  const {
    eventType
  } = o;

  function timeStamp() {
    return new Date().toUTCString();
  }

  function propName() {
    const e = eventType || EventTypes.CREATE
    return e.toLowerCase() + 'Time';
  }

  return Object.assign({}, o, {
    [propName()]: timeStamp(),
  });
}

/**
 * Mix in standard model properties 
 */
const enrichModel = compose(
  addId,
  addModelName,
  addTimestamp,
);

/**
 * Mix in standard event properties
 */
const enrichEvent = compose(
  addId,
  addEventName,
  addTimestamp
);

export default class ModelFactoryInstance {
  constructor() {
    modelFactories = new Map();
    eventFactories = {
      [EventTypes.CREATE]: new Map(),
      [EventTypes.UPDATE]: new Map(),
      [EventTypes.DELETE]: new Map()
    }
  }

  /**
   * Register a factory function to create the model `modelName`
   * @param {String} modelName 
   * @param {Function} factoryFunction 
   */
  registerModel(modelName, factoryFunction) {
    modelName = checkModelName(modelName);

    if (!modelFactories.has(modelName)
      && typeof factoryFunction === 'function') {
      modelFactories.set(modelName, factoryFunction);
    }
  }

  /**
   * Register a factory function to create an event for the model `modelName`
   * @param {String} eventType Name of event {@link EventTypes}
   * @param {String} modelName
   * @param {Function} factoryFunction
   */
  registerEvent(eventType, modelName, factoryFunction) {
    modelName = checkModelName(modelName);
    eventType = checkEventType(eventType);

    if (typeof factoryFunction === 'function') {
      eventFactories[eventType].set(modelName, factoryFunction);
    }
  }

  listModels() {
    return [...modelFactories.values()];
  }

  /**
   * Call the factory function previously registered for `modelName`
   * @see {@link registerModel} for further info 
   * @param {String} modelName 
   * @param {*} args
   * @returns {Promise<Model>} the model instance
   */
  async createModel(modelName, args) {
    modelName = checkModelName(modelName);

    if (modelFactories.has(modelName)) {
      const model = await Model.create({
        factory: modelFactories.get(modelName),
        args: args,
        modelName: modelName
      });

      return Object.freeze(model);
    }
    throw new Error('unregistered model');
  }

  /**
   * Call factory function previously registered for `eventType`
   * @see {@link registerEvent}
   * @param {String} eventType 
   * @param {String} modelName 
   * @param {*} args 
   * @returns {Promise<Event>} the event instance
   */
  async createEvent(eventType, modelName, args) {
    modelName = checkModelName(modelName);
    eventType = checkEventType(eventType);

    if (eventFactories[eventType].has(modelName)) {
      const event = await eventFactories[eventType].get(modelName)(args);
      const options = {
        generateId: uuid,
        modelName: modelName,
        eventType: eventType,
      }

      return Object.freeze(
        enrichEvent({ ...event, ...options })
      );
    }
    throw new Error('unregistered model event');
  }
}