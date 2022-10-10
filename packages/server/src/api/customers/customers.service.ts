/* eslint-disable no-case-declarations */
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import mockData from '../../fixtures/mockData';
import { Account } from '../accounts/entities/accounts.entity';
import { Audience } from '../audiences/entities/audience.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { checkInclusion } from '../audiences/audiences.helper';
import { EventDto } from '../events/dto/event.dto';
import {
  CustomerKeys,
  CustomerKeysDocument,
} from './schemas/customer-keys.schema';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export type Correlation = {
  cust: CustomerDocument;
  found: boolean;
};

@Injectable()
export class CustomersService {
  constructor(
    @InjectQueue('customers') private readonly customersQueue: Queue,
    @InjectModel(Customer.name) public CustomerModel: Model<CustomerDocument>,
    @InjectModel(CustomerKeys.name)
    private CustomerKeysModel: Model<CustomerKeysDocument>,
    @InjectRepository(Audience)
    private audiencesRepository: Repository<Audience>
  ) {}

  async create(
    account: Account,
    createCustomerDto: CreateCustomerDto
  ): Promise<Customer> {
    const createdCustomer = new this.CustomerModel({
      ownerId: (<Account>account).id,
      ...createCustomerDto,
    });
    const ret = await createdCustomer.save();
    // Already started (isEditable = false), dynamic (isDyanmic = true),push
    // Not started (isEditable = true), dynamic (isDyanmic = true), push
    const dynamicAuds = await this.audiencesRepository.findBy({
      ownerId: (<Account>account).id,
      isDynamic: true,
      isPrimary: true,
    });
    for (let index = 0; index < dynamicAuds.length; index++) {
      if (checkInclusion(ret, dynamicAuds[index].inclusionCriteria)) {
        await this.audiencesRepository.update(
          { ownerId: (<Account>account).id, id: dynamicAuds[index].id },
          {
            customers: dynamicAuds[index].customers.concat(ret.id),
          }
        );
      }
    }
    // Already started(isEditable = true), static(isDyanmic = false), don't push
    // Not started(isEditable = false), static(isDyanmic = false), push
    const staticAuds = await this.audiencesRepository.findBy({
      ownerId: (<Account>account).id,
      isDynamic: false,
      isPrimary: true,
      isEditable: false,
    });
    for (let index = 0; index < staticAuds.length; index++) {
      if (checkInclusion(ret, staticAuds[index].inclusionCriteria)) {
        await this.audiencesRepository.update(
          { ownerId: (<Account>account).id, id: staticAuds[index].id },
          {
            customers: staticAuds[index].customers.concat(ret.id),
          }
        );
      }
    }
    return ret;
  }

  async addPhCustomers(data: any, accountId: string) {
    for (let index = 0; index < data.length; index++) {
      if (index == 0) {
        console.log(JSON.stringify(data[index], null, 2));
      }
      const createdCustomer = new this.CustomerModel({
        //ownerId: accountId,
      });
      createdCustomer['ownerId'] = accountId;
      createdCustomer['posthogId'] = data[index]['id'];
      createdCustomer['phCreatedAt'] = data[index]['created_at'];
      if (data[index]?.properties?.$initial_os) {
        createdCustomer['phInitialOs'] = data[index]?.properties.$initial_os;
      }
      if (data[index]?.properties?.$geoip_time_zone) {
        createdCustomer['phGeoIpTimeZone'] =
          data[index]?.properties.$geoip_time_zone;
      }
      //add lon check as well for completeness
      //Note that longitude comes first in a GeoJSON coordinate array, not latitude.
      if (data[index]?.properties?.$geoip_latitude) {
        const phGeoip = {
          type: 'Point',
          coordinates: [
            data[index]?.properties.$geoip_longitude,
            data[index]?.properties.$geoip_latitude,
          ],
          //index: '2dsphere'
        };
        //createdCustomer['phGeoip_latitude']= data[index]?.properties.$geoip_latitude
        //createdCustomer['phGeoIp'] = phGeoip;
      }
      if (data[index]?.properties?.$initial_geoip_latitude) {
        const phInitial_geoip = {
          type: 'Point',
          coordinates: [
            data[index]?.properties.$initial_geoip_longitude,
            data[index]?.properties.$initial_geoip_latitude,
          ],
          //index: '2dsphere'
        };
        //createdCustomer['phInitial_geoip_latitude']= data[index]?.properties.$initial_geoip_latitude
        //createdCustomer['phInitialGeoIp']= phInitial_geoip;
      }

      if (index == 0) {
        console.log(JSON.stringify(createdCustomer, null, 2));
      }

      const ret = await createdCustomer.save();
      if (index == 0) {
        console.log('ret is', ret);
      }
    }
  }

  async findAll(account: Account): Promise<CustomerDocument[]> {
    return this.CustomerModel.find({ ownerId: (<Account>account).id }).exec();
  }

  async returnAllPeopleInfo(account: Account) {
    const data = await this.findAll(<Account>account);
    const listInfo = data.map((person) => {
      const info = {};
      (info['id'] = person['_id'].toString()),
        (info['salient'] = person['email']
          ? person['email']
          : person['slackEmail']
          ? person['slackEmail']
          : person['slackRealName']
          ? person['slackRealName']
          : '...');
      return info;
    });
    return listInfo;
  }

  async ingestPosthogPersons(
    proj: string,
    phAuth: string,
    phUrl: string,
    accountId: string
  ) {
    console.log('in ingest');
    let posthogUrl: string;
    console.log(phUrl[phUrl.length - 1]);
    if (phUrl[phUrl.length - 1] == '/') {
      posthogUrl = phUrl + 'api/projects/' + proj + '/persons/';
    } else {
      posthogUrl = phUrl + '/api/projects/' + proj + '/persons/';
    }
    //let posthogUrl = "https://app.posthog.com/api/projects/" + proj + "/persons/";
    const authString = 'Bearer ' + phAuth;
    try {
      console.log('over here');
      const job = await this.customersQueue.add({
        url: posthogUrl,
        auth: authString,
        account: accountId,
      });
      console.log(job);
      console.log('completed job');
    } catch (e) {
      console.log('error ', e);
    }
    /*
    console.log("in ingest");
    try{
        //https://app.posthog.com/api/projects/:project_id/persons/
        const res = await axios({
            method: 'get',
            url: "https://app.posthog.com/api/projects/2877/persons/",
            headers: {
                Authorization: 'Bearer phx_UUMEhd0XChUyRbEIsAKNikp1TZzGa2ebhEpX3XLdV9F'
            }
        });
    console.log("res", res);
    }
    catch(e){
        console.log("e is", e);
    }
    */
  }

  async findByAudience(
    account: Account,
    audienceId: string
  ): Promise<CustomerDocument[]> {
    return this.CustomerModel.find({
      ownerId: (<Account>account).id,
      audiences: audienceId,
    }).exec();
  }

  async findById(
    account: Account,
    customerId: string
  ): Promise<CustomerDocument> {
    const found = await this.CustomerModel.findById(customerId).exec();
    if (found && found?.ownerId == (<Account>account).id) return found;
    return;
  }

  async findBySlackId(
    account: Account,
    slackId: string
  ): Promise<CustomerDocument> {
    const customers = await this.CustomerModel.find({
      ownerId: (<Account>account).id,
      slackId: slackId,
    }).exec();
    return customers[0];
    //return found;
  }

  async findByExternalIdOrCreate(
    account: Account,
    id: string
  ): Promise<CustomerDocument> {
    const customers = await this.CustomerModel.find({
      ownerId: (<Account>account).id,
      externalId: id,
    }).exec();
    if (customers.length < 1) {
      const createdCustomer = new this.CustomerModel({
        ownerId: (<Account>account).id,
        externalId: id,
      });
      return createdCustomer.save();
    } else return customers[0];
  }

  async findByCustomEvent(account: Account, id: string): Promise<Correlation> {
    const customers = await this.CustomerModel.find({
      ownerId: (<Account>account).id,
      slackId: id,
    }).exec();
    if (customers.length < 1) {
      const createdCustomer = new this.CustomerModel({
        ownerId: (<Account>account).id,
        slackId: id,
      });
      return { cust: await createdCustomer.save(), found: false };
    } else return { cust: customers[0], found: true };
  }

  async findBySpecifiedEvent(
    account: Account,
    correlationKey: string,
    correlationValue: string,
    event: any,
    mapping?: (event: any) => any
  ): Promise<Correlation> {
    const queryParam = {};
    queryParam[correlationKey] = correlationValue;
    const customers = await this.CustomerModel.find(queryParam).exec();
    if (customers.length < 1) {
      if (mapping) {
        const newCust = mapping(event);
        newCust['ownerId'] = (<Account>account).id;
        const createdCustomer = new this.CustomerModel(newCust);
        return { cust: await createdCustomer.save(), found: false };
      } else {
        const createdCustomer = new this.CustomerModel({
          ownerId: (<Account>account).id,
          correlationKey: correlationValue,
        });
        return { cust: await createdCustomer.save(), found: false };
      }

      //to do cant just return [0] in the future
    } else return { cust: customers[0], found: true };
  }

  /**
   * Finds all customers that match the inclusion criteria. Uses findAll under
   * the hood.
   *
   * @remarks
   * Optimize this to happen inside of mongo later.
   *
   * @param account - The owner of the customers
   * @param criteria - Inclusion criteria to match on
   *
   */
  async findByInclusionCriteria(
    account: Account,
    criteria: any
  ): Promise<CustomerDocument[]> {
    let customers: CustomerDocument[] = [];
    const ret: CustomerDocument[] = [];
    try {
      customers = await this.findAll(account);
    } catch (err) {
      return Promise.reject(err);
    }
    customers.forEach((customer) => {
      if (checkInclusion(customer, criteria)) ret.push(customer);
    });
    return Promise.resolve(ret);
  }

  checkInclusion(customer: CustomerDocument, inclusionCriteria: any): boolean {
    return checkInclusion(customer, inclusionCriteria);
  }

  /**
   * Find a single customer that has [correlationKey]=correlationValue
   * belonging to account.id
   *
   * @remarks
   * Optimize this to happen inside of mongo later.
   *
   * @param account - The owner of the customers
   * @param correlationKey - matching key to use, i.e. email or slackId
   * @param correlationValue - matching value to use, i.e. a@b.com or UABC1234
   *
   */
  async findByCorrelationKVPair(
    account: Account,
    correlationKey: string,
    correlationValue: string
  ): Promise<CustomerDocument> {
    let customer: CustomerDocument; // Found customer
    const queryParam = { ownerId: (<Account>account).id };
    queryParam[correlationKey] = correlationValue;
    try {
      customer = await this.CustomerModel.findOne(queryParam).exec();
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve(customer);
  }

  async findOrCreateByCorrelationKVPair(
    account: Account,
    dto: EventDto
  ): Promise<Correlation> {
    let customer: CustomerDocument; // Found customer
    const queryParam = { ownerId: (<Account>account).id };
    queryParam[dto.correlationKey] = dto.correlationValue;
    try {
      customer = await this.CustomerModel.findOne(queryParam).exec();
    } catch (err) {
      return Promise.reject(err);
    }
    if (!customer) {
      const createdCustomer = new this.CustomerModel(queryParam);
      return { cust: await createdCustomer.save(), found: false };
    } else return { cust: customer, found: true };
  }

  async mergeCustomers(
    account: Account,
    oldCustomer: any,
    newCustomer: any
  ): Promise<void> {
    //we assume newer information is more up to date
    oldCustomer.slackName = newCustomer.name;

    if (newCustomer.real_name != null) {
      oldCustomer.slackRealName = newCustomer.real_name;
    }
    if (newCustomer.team_id?.length)
      oldCustomer.slackTeamId = newCustomer.team_id;

    if (newCustomer.profile?.first_name) {
      oldCustomer.firstName = newCustomer.profile.first_name;
    }

    if (newCustomer.profile?.last_name) {
      oldCustomer.lastName = newCustomer.profile.last_name;
    }
    if (newCustomer.tz_offset != null) {
      oldCustomer.slackTimeZone = newCustomer.tz_offset;
    }
    if (newCustomer.profile?.email != null) {
      oldCustomer.slackEmail = newCustomer.profile.email;
    }
    oldCustomer.slackDeleted = newCustomer.deleted;
    oldCustomer.slackAdmin = newCustomer.is_admin;
    //false until specified by user
    if (!newCustomer.is_admin) {
      oldCustomer.slackTeamMember = false;
    } else {
      oldCustomer.slackTeamMember = true;
    }
    await oldCustomer.save();

    // await this.CustomerModel.aggregate(
    //   [
    //     {$replaceRoot:
    //       {newRoot:
    //         {$mergeObjects: [oldCustomer,newCustomer]}
    //       }
    //     }
    //   ]
    // );
  }

  async getAttributes(resourceId: string) {
    const attributes = await this.CustomerKeysModel.find().exec();
    if (resourceId === 'attributes') {
      return {
        id: resourceId,
        nextResourceURL: 'attributeConditions',
        options: attributes.map((attribute) => ({
          label: attribute.key,
          id: attribute.key,
          nextResourceURL: attribute.key,
        })),
        type: 'select',
      };
    }

    const attribute = attributes.find(
      (attribute) => attribute.key === resourceId
    );
    if (attribute)
      return {
        id: resourceId,
        options: attributeConditions(attribute.type, attribute.isArray),
        type: 'select',
      };

    return (
      mockData.resources.find((resource) => resource.id === resourceId) || {}
    );
  }
}

const attributeConditions = (type: string, isArray: boolean): any[] => {
  if (isArray) {
    return [
      { label: 'contains', id: 'contains', where: '' },
      { label: 'does not contain', id: 'doesNotContain', where: '' },
    ];
  }
  switch (type) {
    case 'String':
      return [
        { label: 'is equal to', id: 'isEqual', where: '' },
        { label: 'is not equal to', id: 'isNotEqual', where: '' },
        { label: 'exists', id: 'exists', where: '' },
        { label: 'does not exist', id: 'doesNotExist', where: '' },
        { label: 'contains', id: 'contains', where: '' },
        { label: 'does not contain', id: 'doesNotContain', where: '' },
      ];
    case 'Email':
      return [
        { label: 'is equal to', id: 'isEqual', where: '' },
        { label: 'is not equal to', id: 'isNotEqual', where: '' },
        { label: 'exists', id: 'exists', where: '' },
        { label: 'does not exist', id: 'doesNotExist', where: '' },
        { label: 'contains', id: 'contains', where: '' },
        { label: 'does not contain', id: 'doesNotContain', where: '' },
      ];
    case 'Number':
      return [
        { label: 'is equal to', id: 'isEqual', where: '' },
        { label: 'is not equal to', id: 'isNotEqual', where: '' },
        { label: 'is greater than', id: 'isGreaterThan', where: '' },
        { label: 'is less than', id: 'isLessThan', where: '' },
        { label: 'exists', id: 'exists', where: '' },
        { label: 'does not exist', id: 'doesNotExist', where: '' },
      ];
    case 'Boolean':
      return [
        { label: 'is equal to', id: 'isBoolEqual', where: '' },
        { label: 'is not equal to', id: 'isBoolNotEqual', where: '' },
      ];
    case 'Date':
      return [
        {
          label: 'before',
          id: 'isTimestampBefore',
          where: '',
        },
        { label: 'after', id: 'isTimestampAfter', where: '' },
      ];
  }
};