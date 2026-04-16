import { DataTypes, Model, ModelCtor } from "sequelize";

const schema_type = {
  string() {
    return {
      type: DataTypes.STRING,
      allowNull: false,
    };
  },

  unique_string() {
    return {
      ...this.string(),
      unique: true,
    };
  },

  int( val?: number) {
    return {
      type: DataTypes.INTEGER,
      allowNull: false,
      ...( val || val === 0 ? { default: val} : {} )
    };
  },

  float() {
    return {
      type: DataTypes.FLOAT,
      allowNull: false,
    };
  },

  double(){
    return {
      type: DataTypes.DOUBLE,
      allowNull: false
    }

  },

  enum(...val: string[]){
    return {
      type: DataTypes.ENUM(...val),
      allowNull: false
    }
  },

  int_auto(){
    return {
      type: DataTypes.INTEGER,
      autoIncrement: true,
    };
  },


  primary_key() {
    return {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    };
  },

  primary_key_uuid(){
    return {
      type: DataTypes.UUID,
      required: true,
      primaryKey: true
    }
  },

  primary_key_string(){
    return {
      type: DataTypes.STRING,
      required: true,
      primaryKey: true
    }
  },

  boolean( default_val?: boolean ){
    return {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        ...( default_val ? { defaultValue: default_val } : {})
    }
  },

  array( type: DataType ){
    return {
        type: DataTypes.ARRAY( type ),
        allowNull: false
    }
  },
  
  optional<T = any >( type: SchemaType<T> ){

    let _type = type;

    _type.allowNull = true;
    
    return _type

  },

  optional_enum( ...val: string[] ){
    return {
      type: DataTypes.ENUM(...val),
      allowNull: true
    }
  },

  optional_boolean(){
    return {
      type: DataTypes.BOOLEAN,
      allowNull: true
    }
  },

  unique<T = any >( type: SchemaType<T> ){

    let _type = type;

    _type.unique = true;
    
    return _type;

  },

  json(){
    return {
      type: DataTypes.JSON,
      required: true
    }
  },

  jsonb(){
    return {
      type: DataTypes.JSONB,
      required: true
    }
  },

  date(){
    return {
      type: DataTypes.DATE,
      required: true
    }
  },

  point(){

    return {
      type: DataTypes.GEOMETRY('POINT'),
      required: true 
    }

  },

  long_text(){

    return {
      type: DataTypes.TEXT('long'),
      required: true 
    }

  },

  decimal(precision: number, scale: number){
    return {
      type: DataTypes.DECIMAL({
        precision,
        scale
      }),
      required: true
    }
  },

  number(precision: number, scale: number){
    return {
      type: DataTypes.NUMBER({
        precision,
        scale
      }),
      required: true
    }
  },

  optional_long_text(){

    return this.optional( { type: DataTypes.TEXT('long')} )

  },

  optional_string(){
    return this.optional( { type: DataTypes.TEXT } as any )
  },

  optional_int(){
    return this.optional( this.int() )
  },

  optional_double(){
    return this.optional( this.double() )
  },



  


}; 


export interface SchemaType< T > {
    type: T,
    allowNull: boolean,
    unique?: boolean
}

type DataType = DataTypes.IntegerDataTypeConstructor | DataTypes.StringDataTypeConstructor | DataTypes.DoubleDataTypeConstructor | DataTypes.AbstractDataType;

export default schema_type;

export type InferedSchemaType<T extends {} > =  ModelCtor<Model<T>>

export type ExtractComminAtrributeFromUnion<A, B extends A > =  A;

export type ChildOf <T extends any[]> = T extends (infer U)[] ? U : never; 