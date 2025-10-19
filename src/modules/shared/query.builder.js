import { aql } from 'arangojs';

export function buildAqlQuery(collectionName, schema, { filter = {}, sort, limit = 50, cursor = null, fields }, docVar = 'doc', initialFilterClauses = []) {
  const bindVars = {};
  const filterClauses = [...initialFilterClauses];
  filterClauses.push(aql`${aql.literal(`${docVar}.deletedAt`)} == null`);
  const fieldIdentifier = aql.literal(`${docVar}`);

  for (const field in filter) {
    if (schema.properties && schema.properties[field]) {
      const value = filter[field];
      const fieldPath = aql.literal(`${docVar}.${field}`);
      const fieldType = schema.properties[field].type;
      const fieldFormat = schema.properties[field].format;

      if (typeof value === 'string' && value.includes(',')) {
        const values = value.split(',');
        filterClauses.push(aql`${fieldPath} IN ${values}`);
        continue;
      }
      
      if (fieldType === 'string' && (fieldFormat === 'date' || fieldFormat === 'date-time')) {
        const parts = String(value).split('/');
        if (parts.length === 2) {
          filterClauses.push(aql`${fieldPath} >= ${parts[0]} AND ${fieldPath} <= ${parts[1]}`);
        } else {
          filterClauses.push(aql`${fieldPath} == ${String(value)}`);
        }
      } 
      else if (fieldType === 'number' || fieldType === 'integer') {
        const parts = String(value).split('-');
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          filterClauses.push(aql`${fieldPath} >= ${Number(parts[0])} AND ${fieldPath} <= ${Number(parts[1])}`);
        } else {
          filterClauses.push(aql`${fieldPath} == ${Number(value)}`);
        }
      }
      else if (fieldType === 'string') {
        filterClauses.push(aql`STARTS_WITH(${fieldPath}, ${String(value)})`);
      }
      else {
        filterClauses.push(aql`${fieldPath} == ${value}`);
      }
    }
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10)), 1000);
  let sortExpression = aql``;
  let sortField = null;
  let sortDirection = 'ASC';

  if (sort && typeof sort === 'string') {
    sortDirection = sort.startsWith('-') ? 'DESC' : 'ASC';
    const potentialSortField = sort.replace(/^-/, '');
    if (schema.properties && schema.properties[potentialSortField]) {
      sortField = potentialSortField;
      sortExpression = aql`SORT ${aql.literal(`${docVar}.${sortField}`)} ${sortDirection}`;
    }
  }

  if (cursor && sortField) {
    const operator = sortDirection === 'DESC' ? aql`<` : aql`>`;
    let cursorValue = cursor;
    try { cursorValue = JSON.parse(cursor); } catch (e) { /* fallback */ }
    filterClauses.push(aql`${aql.literal(`${docVar}.${sortField}`)} ${operator} ${cursorValue}`);
  }

  let returnExpression = fieldIdentifier;
  if (fields && typeof fields === 'string') {
    const fieldsToKeep = fields.split(',').map(f => f.trim());
    if (fieldsToKeep.length > 0) {
      if (sortField && !fieldsToKeep.includes(sortField)) {
        fieldsToKeep.push(sortField);
      }
      returnExpression = aql`KEEP(${fieldIdentifier}, ${fieldsToKeep})`;
    }
  }

  const query = aql`
    FOR ${aql.literal(docVar)} IN ${aql.literal(collectionName)}
    ${filterClauses.length > 0 ? aql.join([aql`FILTER`, ...filterClauses], ' AND ') : aql``}
    ${sortExpression}
    LIMIT ${safeLimit}
    RETURN ${returnExpression}
  `;

  return { query, bindVars, sortField };
}
