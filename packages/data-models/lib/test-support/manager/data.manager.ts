import { newDocumentClient } from '../helper/model.helper';
import { Demo, DemoModel, NotFoundError } from '../../models/index';
import { Config } from '../config/config';
import { v4 as uuidv4 } from 'uuid';
import * as templates from '../templates';

const RESERVED_IDENTIFIER_PREFIX = 'RESERVED_';

interface DefaultResources {
  demo?: Demo;
}

// Class used to instantiate test resources and manage their lifecycle
export class DataManager {
  private demoModel: DemoModel;

  private myUserId?: string;
  private defaultResources: DefaultResources = {};
  private demos: Record<string, Demo> = {};

  constructor(configuration = Config.loadConfigFromEnv().configuration) {
    const client = newDocumentClient(configuration);
    this.demoModel = new DemoModel(configuration.demoTable, client);
  }

  /**
   * Sets the ID of the current user, which is used to create memberships for that user.
   * @param userId - ID of the authenticated user who sends API requests
   */
  setMyUserId(userId: string) {
    this.myUserId = userId;
  }

  /**
   * @returns ID of the current authenticated user
   */
  getMyUserId() {
    if (!this.myUserId) {
      throw new Error('myUserId has not been set yet.');
    }
    return this.myUserId;
  }

  private manageResource<T>(managedResources: Record<string, T>, resource: T, identifier: string = uuidv4()) {
    if (identifier?.startsWith(RESERVED_IDENTIFIER_PREFIX)) {
      throw new Error(`Invalid identifier: '${identifier}'. All identifiers starting with '${RESERVED_IDENTIFIER_PREFIX}' are reserved for DataManager.`);
    }
    if (managedResources[identifier]) {
      throw new Error(`A resource of this type already exists with identifier: ${identifier}.`);
    }
    managedResources[identifier] = { ...resource };
    return identifier;
  }

  /**
   * getX methods allow you to retrieve the resources managed by DataManager: resources explicitly
   * created in your test case and dependencies created by DataManager. You can use them freely
   * inside your test steps: they have no side effects.
   */
  /**
   * @param identifier Unique identifier of the resource.
   * @param name Human friendly name of the resource type.
   * @param managedResources List of managed resources of this resource type.
   * @param defaultResource Default resource of this resource type.
   * @returns Managed resource
   */
  private getResource<T>(name: string, managedResources: Record<string, T>, defaultResource: T|undefined, identifier?: string) {
    let resource: T;
    if (identifier) {
      resource = managedResources[identifier];
      if (!resource) {
        throw new Error(`No ${name} found for identifier: ${identifier}. Ensure that a test step creates the resource before "getting" it.`);
      }
    } else {
      if (!defaultResource) {
        throw new Error(`No default ${name} exists. Check that the test is written correctly or if you forgot to specify the resource identifier.`);
      }
      resource = defaultResource;
    }
    return { ...resource };
  }

  /**
   * @param identifier Demo ID
   * @returns Managed demo resource matching the identifier or default resource.
   */
  getDemo = (identifier?: string) =>
    this.getResource('demo', this.demos, this.defaultResources.demo, identifier);

  /**
   * Allow `DataManager` to manage the lifecycle of a resource that it did not create.
   * @param demo Resource to manage
   * @returns Resource identifier
   */
  manageDemo = (demo: Demo) =>
    this.manageResource<Demo>(this.demos, demo, demo.id);

  /**
   * Creates a Demo
   * @returns Managed demo resource
   */
  async createDemo(isDefault = true, overrides?: Partial<Omit<Demo, 'id'>>) {
    this.checkIfDefaultExists('demo', this.defaultResources.demo, isDefault);

    const demo = await this.demoModel.create({
      ...templates.DEMO_TEMPLATE,
      ...overrides,
    });

    this.demos[demo.id] = demo;
    if (isDefault) {
      this.defaultResources.demo = demo;
    }
    return { ...demo };
  }



  /**
   * Deletes all the managed resources to clean up after running a test case.
   */
  async deleteAll() {
    const identifierErr = (err: any) => {
      if (!(err instanceof NotFoundError)) {
        throw err;
      }
    };

    const deletionPromises: Promise<any>[] = [];
    console.log(this.demos);
    const demosToDelete = Object.values(this.demos);
    demosToDelete.forEach(s =>
      deletionPromises.push(this.demoModel.delete(s.id).catch(identifierErr)),
    );
    this.demos = {};
    this.defaultResources = {};

    return await Promise.all(deletionPromises);
  }

  /**
   * Checks whether a default resource needs to be created and, in that case, if one already exists.
   * @param resourceName Human-friendly name of the resource type.
   * @param defaultResource Value of the corresponding default resource if it exists.
   * @param isDefault Whether the resource we're trying to create is a default resource.
   */
  private checkIfDefaultExists<T>(resourceName: string, defaultResource: T|undefined, isDefault: boolean) {
    if (isDefault && defaultResource) {
      throw new Error(`A default ${resourceName} already exists.`);
    }
  }

  /**
   * Checks that a resource identifier is not in use and throws an exception if that's the case.
   * @param identifier Identifier that should be checked.
   * @param managedResources Resource map where the identifier should not be present.
   * @param defaultResource Value of the corresponding default resource if it exists.
   * @param resourceName Human-friendly name of the resource type.
   */
  private checkIdentifier<T>(identifier: string|undefined, managedResources: Record<string, T>, defaultResource: T|undefined, resourceName: string) {
    if (identifier !== undefined && managedResources[identifier]) {
      throw new Error(`A ${resourceName} with identifier ${identifier} already exists.`);
    } else if (identifier === undefined && defaultResource) {
      throw new Error(`A default ${resourceName} already exists.`);
    }
  }
}
