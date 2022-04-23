import fs from 'fs';
import { CfnNamedQuery, CfnNamedQueryProps } from 'aws-cdk-lib/aws-athena';
import { Construct } from 'constructs';

export interface NamedQueryProps extends Omit<CfnNamedQueryProps, 'queryString'> {
  readonly path: string;
}

const parseNamedQuery = (queryName: string) => {
  return fs.readFileSync(queryName, 'utf8');
};

export class NamedQuery extends CfnNamedQuery {
  public readonly namedQuery: string;

  constructor(scope: Construct, id: string, props: NamedQueryProps) {
    super(scope, id, {
      database: props.database,
      description: props.description,
      queryString: parseNamedQuery(props.path),
      workGroup: props.workGroup,
    });
  }
}
