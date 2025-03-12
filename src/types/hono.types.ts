import { Pool } from "pg";
import { User } from './User.type';

export interface AppVariables {   
    db: Pool;
    user?: User;

}
